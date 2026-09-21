import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { generateAndStoreReceipt, signReceipt } from '@/lib/payment-receipt';

async function rest<T>(table: string, query: Record<string, string>): Promise<T> {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error('REST');
  return data as T;
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    if (session.role !== 'OWNER') return NextResponse.json({ error: 'Resident access required.' }, { status: 403 });
    const paymentId = new URL(req.url).searchParams.get('paymentId')?.trim() || '';
    if (!paymentId) return NextResponse.json({ error: 'Payment ID is required.' }, { status: 400 });
    const rows = await rest<Array<{ id: string; receiptStoragePath: string | null; receiptNumber: string | null }>>('Payment', { select: 'id,receiptStoragePath,receiptNumber', id: `eq.${paymentId}`, societyId: `eq.${session.societyId}`, ownerUserId: `eq.${session.id}`, status: 'eq.VERIFIED', limit: '1' });
    const payment = rows[0];
    if (!payment) return NextResponse.json({ error: 'Verified payment not found.' }, { status: 404 });
    let receiptNumber = payment.receiptNumber;
    let receiptStoragePath = payment.receiptStoragePath;
    if (!receiptNumber || !receiptStoragePath) {
      const generated = await generateAndStoreReceipt({ paymentId: payment.id, societyId: session.societyId, requestUrl: req.url });
      receiptNumber = generated.receiptNumber;
      receiptStoragePath = generated.receiptStoragePath;
    }
    const url = await signReceipt(receiptStoragePath);
    if (!url) return NextResponse.json({ error: 'Receipt download unavailable.' }, { status: 503 });
    return NextResponse.json({ receiptNumber, url });
  } catch (error) {
    console.error('Resident receipt download failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to prepare receipt download.' }, { status: 500 });
  }
}
