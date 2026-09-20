import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSubAdminPermission } from '@/lib/session';

const schema = z.object({
  title: z.string().trim().min(1).max(180),
  gujaratiTitle: z.string().max(180).optional(),
  date: z.coerce.date(),
  time: z.string().max(50).optional(),
  location: z.string().max(240).optional(),
  type: z.string().max(100).optional(),
  description: z.string().max(3000).optional(),
  imageUrl: z.string().max(500).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
  visibility: z.string().max(30).default('OWNER'),
});

async function rest<T>(q: Record<string, string>, init?: RequestInit) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw Error('CONFIG');
  const url = new URL(`${base}/rest/v1/Event`);
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
  if (!response.ok) throw Error('REST');
  return data as T;
}

const safeMedia = (value: string | undefined, societyId: string) =>
  !value || /^https?:\/\//.test(value) || value.startsWith('data:') ||
  (value.startsWith(`${societyId}/`) && !value.includes('://') && !value.includes('\\') && !value.includes('..'));

export async function GET() {
  try {
    const session = await requireSubAdminPermission('EVENTS');
    return NextResponse.json(await rest<any[]>({ select: '*', societyId: `eq.${session.societyId}`, order: 'date.desc' }));
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSubAdminPermission('EVENTS');
    const parsed = schema.parse(await req.json());
    const imageUrl = parsed.imageUrl?.trim() || undefined;
    if (!safeMedia(imageUrl, session.societyId)) {
      return NextResponse.json({ error: 'Invalid image path' }, { status: 400 });
    }
    const rows = await rest<any[]>({ select: '*' }, {
      method: 'POST',
      body: JSON.stringify({ ...parsed, imageUrl: imageUrl || null, date: parsed.date.toISOString(), societyId: session.societyId }),
    });
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error('Event create failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
