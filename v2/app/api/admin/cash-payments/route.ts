import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSubAdminPermission } from '@/lib/session';

async function rest<T>(table: string, query: Record<string, string> = {}, init?: RequestInit) {
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

const schema = z.object({
  ownerUserId: z.string().trim().min(1),
  paymentAccountId: z.string().trim().min(1),
  eventId: z.string().trim().optional().or(z.literal('')),
  billId: z.string().trim().optional().or(z.literal('')),
  amountPaise: z.string().regex(/^\d+$/).refine(value => BigInt(value) > 0),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

// Legacy/demo seed owners are preserved for historical references but excluded
// from new live cash collections and owner validation.
const liveOwnerFilters = {
  role: 'eq.OWNER',
  status: 'eq.ACTIVE',
  email: 'not.ilike.*@example.com',
};

export async function GET() {
  try {
    const session = await requireSubAdminPermission('INCOME');
    const [users, accounts, events] = await Promise.all([
      rest<any[]>('User', {
        select: 'id,name,email,mobile,flatId,unitId,residentType',
        societyId: `eq.${session.societyId}`,
        ...liveOwnerFilters,
        and: '(id.not.like.legacy-user-*)',
        order: 'name.asc',
      }),
      rest<any[]>('PaymentAccount', { select: 'id,displayName,purpose,upiId', societyId: `eq.${session.societyId}`, status: 'eq.ACTIVE', order: 'displayName.asc' }),
      rest<any[]>('Event', { select: 'id,title,gujaratiTitle,date', societyId: `eq.${session.societyId}`, order: 'date.desc' }),
    ]);
    return NextResponse.json({ users, accounts, events });
  } catch (error) {
    console.error('Cash collection lookup failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load cash collection options.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSubAdminPermission('INCOME');
    const parsed = schema.parse(await req.json());
    const [owner, account] = await Promise.all([
      rest<any[]>('User', {
        select: 'id,name,email,societyId',
        id: `eq.${parsed.ownerUserId}`,
        societyId: `eq.${session.societyId}`,
        ...liveOwnerFilters,
        and: '(id.not.like.legacy-user-*)',
        limit: '1',
      }),
      rest<any[]>('PaymentAccount', { select: 'id', id: `eq.${parsed.paymentAccountId}`, societyId: `eq.${session.societyId}`, status: 'eq.ACTIVE', limit: '1' }),
    ]);
    if (!owner[0]) return NextResponse.json({ error: 'Resident not found.' }, { status: 404 });
    if (!account[0]) return NextResponse.json({ error: 'Payment account not found.' }, { status: 404 });
    if (parsed.eventId) {
      const event = await rest<any[]>('Event', { select: 'id', id: `eq.${parsed.eventId}`, societyId: `eq.${session.societyId}`, limit: '1' });
      if (!event[0]) return NextResponse.json({ error: 'Program not found.' }, { status: 404 });
    }
    if (parsed.billId) {
      const bill = await rest<any[]>('Bill', { select: 'id,amountPaise,paymentStatus', id: `eq.${parsed.billId}`, societyId: `eq.${session.societyId}`, limit: '1' });
      if (!bill[0]) return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
      if (String(bill[0].amountPaise) !== parsed.amountPaise) return NextResponse.json({ error: 'Cash amount must match the selected bill amount.' }, { status: 400 });
    }
    const now = new Date();
    const payload = {
      id: crypto.randomUUID(),
      societyId: session.societyId,
      eventId: parsed.eventId || null,
      paymentAccountId: parsed.paymentAccountId,
      ownerUserId: parsed.ownerUserId,
      billId: parsed.billId || null,
      amountPaise: parsed.amountPaise,
      status: 'PENDING',
      paymentMethod: 'CASH',
      transactionId: 'CASH_COLLECTION',
      screenshotUrl: null,
      notes: parsed.notes?.trim() || `Cash collected by ${session.id}`,
      initiatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      verifiedAt: null,
      verifiedById: null,
      rejectionReason: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const row = (await rest<any[]>('Payment', { select: '*' }, { method: 'POST', body: JSON.stringify(payload) }))[0];
    return NextResponse.json({ payment: { ...row, amountPaise: String(row.amountPaise) } }, { status: 201 });
  } catch (error) {
    console.error('Cash collection create failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to create cash collection.' }, { status: 400 });
  }
}
