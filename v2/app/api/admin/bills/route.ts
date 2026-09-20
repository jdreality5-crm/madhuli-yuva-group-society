import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSubAdminPermission } from '@/lib/session';

const schema = z.object({
  eventId: z.string().optional(),
  propertyUnitId: z.string().optional().or(z.literal('')),
  type: z.enum(['INVOICE', 'RECEIPT', 'OTHER']),
  amountPaise: z.string().regex(/^\d+$/).refine((value) => BigInt(value) > 0, 'Amount must be positive'),
  vendor: z.string().max(160).optional(),
  category: z.string().max(100).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'OTHER']).optional(),
  notes: z.string().max(1000).optional(),
  paymentStatus: z.enum(['UNPAID', 'PENDING', 'PAID']).optional(),
  fileUrl: z.string().max(500).optional(),
});

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

const safe = (value: string | undefined, societyId: string) =>
  !value || (value.startsWith(`${societyId}/`) && !value.includes('://') && !value.includes('\\') && !value.includes('..'));

export async function GET() {
  try {
    const session = await requireSubAdminPermission('BILLS');
    const rows = await rest<any[]>('Bill', {
      select: '*,Event:eventId(title),PropertyUnit:propertyUnitId(id,label,Property:propertyId(name,propertyNumber,block))',
      societyId: `eq.${session.societyId}`,
      order: 'date.desc',
    });
    return NextResponse.json(rows.map((row) => ({ ...row, amountPaise: String(row.amountPaise) })));
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSubAdminPermission('BILLS');
    const parsed = schema.parse(await req.json());
    const propertyUnitId = parsed.propertyUnitId?.trim() || null;
    const eventId = parsed.eventId?.trim() || null;
    const fileUrl = parsed.fileUrl?.trim() || undefined;
    const date = new Date(`${parsed.date}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid bill date' }, { status: 400 });
    }
    if (!safe(fileUrl, session.societyId)) {
      return NextResponse.json({ error: 'Invalid document path' }, { status: 400 });
    }

    if (propertyUnitId) {
      const units = await rest<any[]>('PropertyUnit', { select: 'id,propertyId', id: `eq.${propertyUnitId}` });
      if (!units.length) return NextResponse.json({ error: 'Property unit not found' }, { status: 404 });
      const properties = await rest<any[]>('Property', {
        select: 'id',
        id: `eq.${units[0].propertyId}`,
        societyId: `eq.${session.societyId}`,
      });
      if (!properties.length) return NextResponse.json({ error: 'Property unit not found' }, { status: 404 });
    }

    if (eventId) {
      const events = await rest<any[]>('Event', { select: 'id', id: `eq.${eventId}`, societyId: `eq.${session.societyId}` });
      if (!events.length) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const rows = await rest<any[]>('Bill', {}, {
      method: 'POST',
      body: JSON.stringify({
        type: parsed.type,
        amountPaise: parsed.amountPaise,
        vendor: parsed.vendor || null,
        category: parsed.category || null,
        date: date.toISOString(),
        paymentMethod: parsed.paymentMethod || null,
        notes: parsed.notes || null,
        paymentStatus: parsed.paymentStatus || 'UNPAID',
        fileUrl: fileUrl || null,
        propertyUnitId,
        eventId,
        societyId: session.societyId,
      }),
    });
    const created = rows[0];
    return NextResponse.json({ ...created, amountPaise: String(created.amountPaise) }, { status: 201 });
  } catch (error) {
    console.error('Bill create failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
