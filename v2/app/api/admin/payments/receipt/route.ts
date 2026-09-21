import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSubAdminPermission } from '@/lib/session';
import { generateAndStoreReceipt, signReceipt } from '@/lib/payment-receipt';

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
  if (!response.ok) throw new Error('REST');
  return data as T;
}

export async function GET(req: Request) {
  try {
    const session = await requireSubAdminPermission('PAYMENTS');
    const parsed = schema.safeParse({ paymentId: new URL(req.url).searchParams.get('paymentId') || '' });
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payment request.' }, { status: 400 });

    const rows = await rest<Array<{ id: string; receiptStoragePath: string | null; receiptNumber: string | null; status: string }>>('Payment', {
      select: 'id,receiptStoragePath,receiptNumber,status',
      id: `eq.${parsed.data.paymentId}`,
      societyId: `eq.${session.societyId}`,
      status: 'eq.VERIFIED',
      limit: '1',
    });
    const payment = rows[0];
    if (!payment) return NextResponse.json({ error: 'Verified payment not found.' }, { status: 404 });

    let receiptNumber = payment.receiptNumber;
    let receiptStoragePath = payment.receiptStoragePath;
    if (!receiptStoragePath || !receiptNumber) {
      const generated = await generateAndStoreReceipt({ paymentId: payment.id, societyId: session.societyId, requestUrl: req.url });
      receiptNumber = generated.receiptNumber;
      receiptStoragePath = generated.receiptStoragePath;
    }

    const url = await signReceipt(receiptStoragePath);
    if (!url) return NextResponse.json({ error: 'Receipt download unavailable.' }, { status: 503 });
    return NextResponse.json({ receiptNumber, url });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'FORBIDDEN' ? 403 : message === 'UNAUTHORIZED' ? 401 : 500;
    console.error('Receipt download link failed', message);
    return NextResponse.json({ error: status === 403 ? 'Organizer access required.' : status === 401 ? 'Authentication required.' : 'Unable to prepare receipt download.' }, { status });
  }
}
