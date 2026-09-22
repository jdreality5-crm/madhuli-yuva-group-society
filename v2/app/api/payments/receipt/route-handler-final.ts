import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { generateAndStoreReceipt, signReceipt } from '@/lib/payment-receipt-safe';

async function rest<T>(table: string, query: Record<string, string>): Promise<T> {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`REST_${response.status}`);
  return data as T;
}

function receiptRequestUrl(req: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const origin = configured || 'https://society-function-management-v2.jdreality5.workers.dev';
  return new URL('/api/payments/receipt', origin).toString();
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const paymentId = new URL(req.url).searchParams.get('paymentId')?.trim() || '';
    if (!paymentId) return NextResponse.json({ error: 'Payment ID is required.' }, { status: 400 });

    const isAdmin = session.role === 'MASTER_ADMIN' || session.role === 'ORGANIZER';
    const query: Record<string, string> = {
      select: 'id',
      id: `eq.${paymentId}`,
      societyId: `eq.${session.societyId}`,
      status: 'eq.VERIFIED',
      limit: '1',
    };

    if (!isAdmin) query.ownerUserId = `eq.${session.id}`;

    const rows = await rest<Array<{ id: string }>>('Payment', query);
    const payment = rows[0];
    if (!payment) return NextResponse.json({ error: 'Verified payment not found.' }, { status: 404 });

    const generated = await generateAndStoreReceipt({ paymentId: payment.id, societyId: session.societyId, requestUrl: receiptRequestUrl(req) });
    const url = await signReceipt(generated.receiptStoragePath);
    if (!url) return NextResponse.json({ error: 'Receipt download unavailable.', code: 'SIGNED_URL_EMPTY' }, { status: 503 });
    return NextResponse.json({ receiptNumber: generated.receiptNumber, url });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Receipt download failed', detail);
    return NextResponse.json({ error: 'Unable to prepare receipt download.', code: detail.slice(0, 120) }, { status: 500 });
  }
}
