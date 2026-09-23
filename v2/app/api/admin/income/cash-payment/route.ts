import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSubAdminPermission } from '@/lib/session';

const schema = z.object({
  eventId: z.string().trim().min(1),
  ownerUserId: z.string().trim().min(1),
  paymentAccountId: z.string().trim().min(1),
  amountPaise: z.coerce.bigint().positive(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

async function rest<T>(table: string, query: Record<string, string>, init?: RequestInit) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
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
  if (!response.ok) throw Error(String(data?.message || data?.hint || 'REST'));
  return data as T;
}

export async function POST(req: Request) {
  try {
    const session = await requireSubAdminPermission('INCOME');
    const parsed = schema.parse(await req.json());

    const [event, owner, account] = await Promise.all([
      rest<any[]>('Event', { select: 'id,title', id: `eq.${parsed.eventId}`, societyId: `eq.${session.societyId}`, limit: '1' }),
      rest<any[]>('User', { select: 'id,name,email,flatId,unitId', id: `eq.${parsed.ownerUserId}`, societyId: `eq.${session.societyId}`, limit: '1' }),
      rest<any[]>('PaymentAccount', { select: 'id,displayName,purpose,status', id: `eq.${parsed.paymentAccountId}`, societyId: `eq.${session.societyId}`, status: 'eq.ACTIVE', limit: '1' }),
    ]);

    if (!event[0]) return NextResponse.json({ error: 'Program not found.' }, { status: 404 });
    if (!owner[0]) return NextResponse.json({ error: 'Resident not found.' }, { status: 404 });
    if (!account[0]) return NextResponse.json({ error: 'Payment account not found.' }, { status: 404 });

    const now = new Date();
    const payment = (await rest<any[]>('Payment', { select: '*' }, {
      method: 'POST',
      body: JSON.stringify({
        id: crypto.randomUUID(),
        societyId: session.societyId,
        eventId: parsed.eventId,
        paymentAccountId: parsed.paymentAccountId,
        ownerUserId: parsed.ownerUserId,
        billId: null,
        amountPaise: parsed.amountPaise.toString(),
        status: 'PENDING',
        paymentMethod: 'CASH',
        transactionId: null,
        screenshotUrl: null,
        notes: parsed.notes?.trim() || 'Cash collection entered by finance staff.',
        initiatedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        verifiedAt: null,
        verifiedById: null,
        rejectionReason: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }),
    }))[0];

    return NextResponse.json({ payment: { ...payment, amountPaise: String(payment.amountPaise) } }, { status: 201 });
  } catch (error) {
    console.error('Cash payment request failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to create cash payment request.' }, { status: 400 });
  }
}
