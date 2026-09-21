import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSubAdminPermission } from '@/lib/session';

const schema = z.object({
  title: z.string().trim().min(1).max(180),
  gujaratiTitle: z.string().max(180).optional(),
  content: z.string().trim().min(1).max(10000),
  gujaratiContent: z.string().max(10000).optional(),
  date: z.coerce.date().optional(),
  important: z.boolean().default(false),
  imageUrl: z.string().max(500).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
});

async function rest<T>(q: Record<string, string>, init?: RequestInit) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw Error('CONFIG');
  const url = new URL(`${base}/rest/v1/Notice`);
  Object.entries(q).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json', Prefer: 'return=representation' } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.message === 'string' ? data.message : typeof data?.hint === 'string' ? data.hint : 'REST request failed';
    throw new Error(`REST:${response.status}:${detail}`);
  }
  return data as T;
}

const safeMedia = (value: string | undefined, societyId: string) =>
  !value || /^https?:\/\//.test(value) || value.startsWith('data:') ||
  (value.startsWith(`${societyId}/`) && !value.includes('://') && !value.includes('\\') && !value.includes('..') && !value.includes('\0'));

const errorStatus = (error: unknown) => {
  if (error instanceof z.ZodError) return 400;
  if (error instanceof Error && error.message === 'FORBIDDEN') return 403;
  if (error instanceof Error && error.message === 'CONFIG') return 500;
  if (error instanceof Error && error.message.startsWith('REST:')) return 502;
  return 500;
};

export async function GET() {
  try {
    const session = await requireSubAdminPermission('NOTICES');
    return NextResponse.json(await rest<any[]>({ select: '*', societyId: `eq.${session.societyId}`, order: 'date.desc' }));
  } catch (error) {
    const status = errorStatus(error);
    console.error('Notice list failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : 'Unable to load notices' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSubAdminPermission('NOTICES');
    const parsed = schema.parse(await req.json());
    const imageUrl = parsed.imageUrl?.trim() || undefined;
    if (!safeMedia(imageUrl, session.societyId)) {
      return NextResponse.json({ error: 'Invalid image path' }, { status: 400 });
    }
    const now = new Date().toISOString();
    const rows = await rest<any[]>({ select: '*' }, {
      method: 'POST',
      body: JSON.stringify({
        id: crypto.randomUUID(),
        ...parsed,
        imageUrl: imageUrl || null,
        date: (parsed.date ?? new Date()).toISOString(),
        societyId: session.societyId,
        createdAt: now,
        updatedAt: now,
      }),
    });
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    const status = errorStatus(error);
    const detail = error instanceof Error ? error.message : '';
    console.error('Notice create failed', detail);
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : status === 502 ? 'Database request failed: ' + detail.replace(/^REST:\d+:/, '') : status === 500 ? 'Server configuration error' : 'Invalid request' }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSubAdminPermission('NOTICES');
    const id = new URL(req.url).searchParams.get('id')?.trim();
    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Notice id is required' }, { status: 400 });
    }
    await rest<unknown>({ id: `eq.${id}`, societyId: `eq.${session.societyId}` }, { method: 'DELETE' });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = errorStatus(error);
    const detail = error instanceof Error ? error.message : '';
    console.error('Notice delete failed', detail);
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : status === 502 ? 'Database request failed' : 'Unable to delete notice' }, { status });
  }
}
