import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSubAdminPermission } from '@/lib/session';

async function rest<T>(table: string, query: Record<string, string> = {}, init?: RequestInit): Promise<T> {
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
  date: z.coerce.date(),
  eventId: z.string().trim().min(1).optional().or(z.literal('')),
  propertyUnitId: z.string().trim().min(1),
  amountPaise: z.string().regex(/^\d+$/).refine((value) => BigInt(value) > 0),
  category: z.string().trim().max(100).optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

async function validateEvent(eventId: string | undefined, societyId: string) {
  if (!eventId) return null;
  const event = (await rest<any[]>('Event', { select: 'id', id: `eq.${eventId}`, societyId: `eq.${societyId}`, limit: '1' }))[0];
  if (!event) throw Error('EVENT_NOT_FOUND');
  return event.id;
}

export async function GET() {
  try {
    const session = await requireSubAdminPermission('INCOME');
    const properties = await rest<any[]>('Property', {
      select: 'id,name,propertyNumber,block',
      societyId: `eq.${session.societyId}`,
      status: 'eq.ACTIVE',
    });
    if (!properties.length) return NextResponse.json({ units: [] });
    const propertyIds = properties.map((property) => property.id);
    const units = await rest<any[]>('PropertyUnit', {
      select: 'id,label,propertyId,residentUserId,ownerName,ownerMobile,ownerEmail,status',
      propertyId: `in.(${propertyIds.join(',')})`,
      status: 'eq.ACTIVE',
      order: 'label.asc',
    });
    const userIds = [...new Set(units.map((unit) => unit.residentUserId).filter(Boolean))];
    const users = userIds.length
      ? await rest<any[]>('User', { select: 'id,name,email,mobile,flatId,unitId', id: `in.(${userIds.join(',')})`, societyId: `eq.${session.societyId}` })
      : [];
    const propertyMap = new Map(properties.map((property) => [property.id, property]));
    const userMap = new Map(users.map((user) => [user.id, user]));
    return NextResponse.json({
      units: units.map((unit) => {
        const property = propertyMap.get(unit.propertyId);
        const user = unit.residentUserId ? userMap.get(unit.residentUserId) : null;
        return {
          id: unit.id,
          label: property?.block ? `${property.block}-${unit.label}` : `${property?.propertyNumber || property?.name || 'Property'} • ${unit.label}`,
          residentUserId: unit.residentUserId || null,
          residentName: user?.name || unit.ownerName || null,
          residentMobile: user?.mobile || unit.ownerMobile || null,
          residentEmail: user?.email || unit.ownerEmail || null,
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return NextResponse.json({ error: message === 'FORBIDDEN' ? 'Income permission required.' : 'Unable to load resident units.' }, { status: message === 'FORBIDDEN' ? 403 : 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSubAdminPermission('INCOME');
    const parsed = schema.parse(await req.json());
    const eventId = await validateEvent(parsed.eventId || undefined, session.societyId);
    const unit = (await rest<any[]>('PropertyUnit', {
      select: 'id,label,residentUserId,propertyId',
      id: `eq.${parsed.propertyUnitId}`,
      limit: '1',
    }))[0];
    if (!unit) return NextResponse.json({ error: 'Resident unit not found.' }, { status: 404 });
    if (!unit.residentUserId) return NextResponse.json({ error: 'This unit is not linked to a registered resident account.' }, { status: 400 });
    const resident = (await rest<any[]>('User', {
      select: 'id,name,email,mobile',
      id: `eq.${unit.residentUserId}`,
      societyId: `eq.${session.societyId}`,
      limit: '1',
    }))[0];
    if (!resident) return NextResponse.json({ error: 'Registered resident account not found.' }, { status: 400 });

    let cashAccount = (await rest<any[]>('PaymentAccount', {
      select: 'id,displayName,purpose',
      societyId: `eq.${session.societyId}`,
      displayName: 'eq.Cash Collection',
      status: 'eq.ACTIVE',
      limit: '1',
    }))[0];
    if (!cashAccount) {
      cashAccount = (await rest<any[]>('PaymentAccount', { select: '*' }, {
        method: 'POST',
        body: JSON.stringify({
          id: crypto.randomUUID(),
          societyId: session.societyId,
          ownerUserId: null,
          displayName: 'Cash Collection',
          upiId: null,
          qrImageUrl: null,
          purpose: 'Cash Collection',
          instructions: 'Cash received by authorized society finance staff.',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      }))[0];
    }

    const now = new Date();
    const notes = [
      '[CASH_COLLECTION]',
      parsed.description ? `Description: ${parsed.description}` : '',
      parsed.category ? `Category: ${parsed.category}` : '',
      parsed.notes ? `Notes: ${parsed.notes}` : '',
      `Collected by: ${session.id}`,
    ].filter(Boolean).join(' | ');
    const payment = (await rest<any[]>('Payment', { select: '*' }, {
      method: 'POST',
      body: JSON.stringify({
        id: crypto.randomUUID(),
        societyId: session.societyId,
        eventId,
        paymentAccountId: cashAccount.id,
        ownerUserId: resident.id,
        billId: null,
        amountPaise: parsed.amountPaise,
        paymentMethod: 'CASH',
        status: 'PENDING',
        transactionId: null,
        screenshotUrl: null,
        notes,
        initiatedAt: now.toISOString(),
        expiresAt: '2099-12-31T23:59:59.000Z',
        verifiedAt: null,
        verifiedById: null,
        rejectionReason: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }),
    }))[0];
    return NextResponse.json({ payment: { ...payment, amountPaise: String(payment.amountPaise) } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = error instanceof z.ZodError ? 400 : message === 'FORBIDDEN' ? 403 : message === 'EVENT_NOT_FOUND' ? 400 : 500;
    return NextResponse.json({ error: status === 400 ? (message === 'EVENT_NOT_FOUND' ? 'Program not found.' : 'Please check the cash collection details.') : status === 403 ? 'Income permission required.' : 'Unable to create cash payment request.' }, { status });
  }
}
