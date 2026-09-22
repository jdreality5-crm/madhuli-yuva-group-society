import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSubAdminPermission } from '@/lib/session';
import { generateAndStoreReceipt, signReceipt } from '@/lib/payment-receipt-safe';

const schema = z.object({ paymentId: z.string().trim().min(1) });

async function rest<T>(table: string, query: Record<string, string>): Promise<T> {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(String(data?.message || data?.hint || 'REST'));
  return data as T;
}

function receiptRequestUrl(req: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const origin = configured || new URL(req.url).origin;
  return new URL('/api/admin/payments/receipt', origin).toString();
}

export async function GET(req: Request) {
  try {
    const session = await requireSubAdminPermission('PAYMENTS');
    const parsed = schema.safeParse({ paymentId: new URL(req.url).searchParams.get('paymentId') || '' });
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payment request.' }, { status: 400 });

    const rows = await rest<any[]>('Payment', {
      select: 'id',
      id: `eq.${parsed.data.paymentId}`,
      societyId: `eq.${session.societyId}`,
      status: 'eq.VERIFIED',
      limit: '1',
    });
    const payment = rows[0];
    if (!payment) return NextResponse.json({ error: 'Verified payment not found.' }, { status: 404 });

    const generated = await generateAndStoreReceipt({
      paymentId: payment.id,
      societyId: session.societyId,
      requestUrl: receiptRequestUrl(req),
    });
    const url = await signReceipt(generated.receiptStoragePath);
    if (!url) throw new Error('STORAGE_SIGN_EMPTY');
    return NextResponse.json({ receiptNumber: generated.receiptNumber, url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    console.error('Receipt download link failed', message);
    const status = message === 'FORBIDDEN' ? 403 : message === 'UNAUTHORIZED' ? 401 : message === 'STORAGE_SIGN_EMPTY' ? 503 : 500;
    return NextResponse.json({
      error: status === 403 ? 'Organizer access required.' : status === 401 ? 'Authentication required.' : status === 503 ? 'Receipt storage link unavailable.' : 'Unable to prepare receipt download.',
      code: message.slice(0, 120),
    }, { status });
  }
}
