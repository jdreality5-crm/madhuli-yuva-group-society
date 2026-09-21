import { NextResponse } from 'next/server';
import { requireSession, requireSubAdminPermission } from '@/lib/session';
import { generateAndStoreReceipt, signReceipt } from '@/lib/payment-receipt';

async function rest<T>(table: string, query: Record<string, string>) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Error('REST');
  return data as T;
}

export async function GET(req: Request, context: { params: Promise<{ paymentId: string }> }) {
  try {
    const session = await requireSession();
    const { paymentId } = await context.params;
    const payments = await rest<any[]>('Payment', { select: 'id,societyId,ownerUserId,status,receiptNumber,receiptStoragePath', id: `eq.${paymentId}`, societyId: `eq.${session.societyId}`, limit: '1' });
    const payment = payments[0];
    if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });

    if (session.role === 'OWNER') {
      if (payment.ownerUserId !== session.id) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
    } else {
      await requireSubAdminPermission('PAYMENTS');
    }
    if (payment.status !== 'VERIFIED') return NextResponse.json({ error: 'Receipt is available after payment verification.' }, { status: 409 });

    let path = payment.receiptStoragePath as string | null;
    if (!path || !payment.receiptNumber) {
      const generated = await generateAndStoreReceipt({ paymentId, societyId: session.societyId, requestUrl: req.url });
      path = generated.receiptStoragePath;
    }
    const signed = await signReceipt(path);
    if (!signed) return NextResponse.json({ error: 'Receipt is not available.' }, { status: 404 });
    return NextResponse.redirect(signed, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    console.error('Receipt download failed', message);
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : status === 403 ? 'Not authorized.' : 'Unable to generate receipt.' }, { status });
  }
}
