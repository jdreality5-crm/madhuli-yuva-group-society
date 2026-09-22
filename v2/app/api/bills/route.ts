import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';

type Unit = { id: string };
async function rest<T>(table: string, params: Record<string, string>): Promise<T> {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(params).forEach(([keyName, value]) => url.searchParams.set(keyName, value));
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(String(data?.message || data?.hint || 'REST'));
  return data as T;
}
async function sign(path: string | null | undefined) {
  if (!path) return null;
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'society-files';
  if (!base || !key) throw new Error('CONFIG');
  const response = await fetch(`${base}/storage/v1/object/sign/${encodeURIComponent(bucket)}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ paths: [path], expiresIn: 3600 }), cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(String(data?.message || data?.error || 'STORAGE_SIGN'));
  const item = Array.isArray(data) ? data[0] : data;
  const signed = item?.signedURL || item?.signedUrl;
  return signed ? (String(signed).startsWith('http') ? String(signed) : base + '/storage/v1' + String(signed)) : null;
}

export async function GET() {
  try {
    const session = await requireSession();
    if (session.role !== 'OWNER') return NextResponse.json({ error: 'Resident access required' }, { status: 403 });

    const [units, receipts] = await Promise.all([
      rest<Unit[]>('PropertyUnit', { select: 'id', residentUserId: `eq.${session.id}` }),
      rest<any[]>('Payment', { select: '*', societyId: `eq.${session.societyId}`, ownerUserId: `eq.${session.id}`, status: 'eq.VERIFIED', order: 'createdAt.desc' }),
    ]);

    let bills: any[] = [];
    if (units.length) {
      const ids = units.map((unit) => unit.id).join(',');
      const rows = await rest<any[]>('Bill', { select: '*', societyId: `eq.${session.societyId}`, propertyUnitId: `in.(${ids})`, order: 'date.desc' });
      bills = await Promise.all(rows.map(async (bill) => ({ ...bill, amountPaise: String(bill.amountPaise), fileUrl: await sign(bill.fileUrl) })));
    }

    return NextResponse.json({ bills, receiptPayments: receipts.map((payment) => ({ ...payment, amountPaise: String(payment.amountPaise) })) });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    console.error('Resident bills failed', message);
    const unauthorized = message === 'UNAUTHORIZED';
    return NextResponse.json({ error: unauthorized ? 'Unauthorized' : 'Unable to load bills.' }, { status: unauthorized ? 401 : 500 });
  }
}
