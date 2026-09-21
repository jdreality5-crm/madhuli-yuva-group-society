import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/session';

const schema = z.object({ paymentId: z.string().trim().min(1) });

type PaymentRow = { id: string; societyId: string; screenshotUrl: string | null };

async function rest<T>(table: string, query: Record<string, string>, init?: RequestInit) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json', Prefer: 'return=representation' } : {}),
    },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error('REST');
  return data as T;
}

async function removeStorage(path: string | null) {
  if (!path) return;
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'society-files';
  if (!base || !key) throw new Error('CONFIG');
  const response = await fetch(`${base}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: [path] }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('STORAGE');
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSession();
    if (session.role !== 'MASTER_ADMIN') {
      return NextResponse.json({ error: 'Master Admin access required.' }, { status: 403 });
    }
    const { paymentId } = schema.parse(await req.json());
    const rows = await rest<PaymentRow[]>('Payment', {
      select: 'id,societyId,screenshotUrl',
      id: `eq.${paymentId}`,
      societyId: `eq.${session.societyId}`,
      limit: '1',
    });
    const payment = rows[0];
    if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });

    await rest('Payment', { id: `eq.${paymentId}`, societyId: `eq.${session.societyId}` }, {
      method: 'PATCH',
      body: JSON.stringify({ transactionId: null, screenshotUrl: null, rejectionReason: null, verifiedAt: null, verifiedById: null }),
    });
    await removeStorage(payment.screenshotUrl);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    console.error('Payment verification details deletion failed', message);
    const status = message === 'UNAUTHORIZED' ? 401 : error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: status === 401 ? 'Authentication required.' : status === 400 ? 'Invalid request.' : 'Unable to delete payment verification details.' }, { status });
  }
}
