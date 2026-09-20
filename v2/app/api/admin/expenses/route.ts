import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSubAdminPermission } from '@/lib/session';

async function rest<T>(table: string, q: Record<string, string>, init?: RequestInit) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
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

const schema = z.object({
  date: z.coerce.date(),
  eventId: z.string().optional(),
  category: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  paidTo: z.string().max(160).optional(),
  amountPaise: z.coerce.bigint().positive(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'OTHER']),
  billNumber: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
});

export async function GET(req: Request) {
  try {
    const session = await requireSubAdminPermission('EXPENSES');
    const url = new URL(req.url);
    const rows = await rest<any[]>('Expense', {
      select: '*,Event:eventId(id,title)',
      societyId: `eq.${session.societyId}`,
      ...(url.searchParams.get('category') ? { category: `eq.${url.searchParams.get('category')}` } : {}),
      order: 'date.desc',
    });
    return NextResponse.json(rows.map((row) => ({ ...row, amountPaise: row.amountPaise.toString() })));
  } catch (error) {
    console.error('Expense list failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSubAdminPermission('EXPENSES');
    const parsed = schema.parse(await req.json());
    const eventId = parsed.eventId?.trim() || null;
    if (eventId) {
      const event = (await rest<any[]>('Event', {
        select: 'id',
        id: `eq.${eventId}`,
        societyId: `eq.${session.societyId}`,
      }))[0];
      if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const now = new Date().toISOString();
    const payload = {
      id: crypto.randomUUID(),
      date: parsed.date.toISOString(),
      eventId,
      category: parsed.category?.trim() || null,
      description: parsed.description?.trim() || null,
      paidTo: parsed.paidTo?.trim() || null,
      amountPaise: parsed.amountPaise.toString(),
      paymentMethod: parsed.paymentMethod,
      billNumber: parsed.billNumber?.trim() || null,
      notes: parsed.notes?.trim() || null,
      societyId: session.societyId,
      createdById: session.id,
      createdAt: now,
      updatedAt: now,
    };
    const row = (await rest<any[]>('Expense', { select: '*' }, { method: 'POST', body: JSON.stringify(payload) }))[0];
    return NextResponse.json({ ...row, amountPaise: row.amountPaise.toString() }, { status: 201 });
  } catch (error) {
    console.error('Expense create failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
