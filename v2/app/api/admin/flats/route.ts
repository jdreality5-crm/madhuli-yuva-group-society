import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/session';

async function rest<T>(table: string, q: Record<string, string> = {}, init?: RequestInit) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw Error('CONFIG');
  const url = new URL(base + '/rest/v1/' + table);
  Object.entries(q).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
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
  flatNumber: z.string().trim().min(1).max(50),
  ownerName: z.string().trim().max(120).optional(),
  mobile: z.string().trim().max(30).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  signupEnabled: z.boolean().default(false),
});

export async function GET() {
  try {
    const session = await requireAdmin();
    const properties = await rest<Array<{ id: string }>>('Property', {
      select: 'id',
      societyId: 'eq.' + session.societyId,
      status: 'eq.ACTIVE',
    });
    const propertyIds = properties.map((property) => property.id);
    if (!propertyIds.length) return NextResponse.json([]);

    const units = await rest<any[]>('PropertyUnit', {
      select: 'id,label,ownerName,ownerMobile,ownerEmail,signupEnabled,status,residentUserId,propertyId,Property:propertyId(name,propertyNumber,block)',
      propertyId: 'in.(' + propertyIds.join(',') + ')',
      order: 'label.asc',
    });

    const registeredUnits = units
      .filter((unit) => unit.ownerName || unit.ownerMobile || unit.ownerEmail || unit.residentUserId)
      .map((unit) => {
        const property = Array.isArray(unit.Property) ? unit.Property[0] : unit.Property;
        const propertyLabel = property?.block || property?.propertyNumber || property?.name || 'Property';
        return {
          id: unit.id,
          flatNumber: property?.block ? propertyLabel + '-' + unit.label : propertyLabel + ' • ' + unit.label,
          ownerName: unit.ownerName || null,
          mobile: unit.ownerMobile || null,
          email: unit.ownerEmail || null,
          status: unit.status,
          signupEnabled: Boolean(unit.signupEnabled),
          source: 'PROPERTY_UNIT',
        };
      });

    return NextResponse.json(registeredUnits);
  } catch (error) {
    const status = error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : 'Server error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const data = schema.parse(await req.json());
    const flatNumber = data.flatNumber.trim();
    const email = data.email?.trim() || null;
    const mobile = data.mobile?.trim() || null;
    if (data.signupEnabled && !email && !mobile) return NextResponse.json({ error: 'Add a registered email or mobile before enabling Owner signup.' }, { status: 400 });
    const existing = (await rest<any[]>('Flat', { select: 'id', societyId: 'eq.' + session.societyId, flatNumber: 'ilike.' + flatNumber }))[0];
    if (existing) return NextResponse.json({ error: 'This flat number already exists.' }, { status: 409 });
    const now = new Date().toISOString();
    const row = (await rest<any[]>('Flat', { select: '*' }, { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), flatNumber, ownerName: data.ownerName?.trim() || null, mobile, email, status: data.status, signupEnabled: data.signupEnabled, societyId: session.societyId, createdAt: now, updatedAt: now }) }))[0];
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 400 ? 'Please check the flat and owner details.' : status === 403 ? 'Forbidden' : 'Server error' }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAdmin();
    const data = z.object({ id: z.string().min(1), ownerName: z.string().trim().max(120).optional(), mobile: z.string().trim().max(30).optional(), email: z.string().trim().email().optional().or(z.literal('')), status: z.enum(['ACTIVE', 'INACTIVE']).optional(), signupEnabled: z.boolean() }).parse(await req.json());
    const flat = (await rest<any[]>('Flat', { select: 'id,email,mobile', id: 'eq.' + data.id, societyId: 'eq.' + session.societyId }))[0];
    if (!flat) return NextResponse.json({ error: 'Flat records are managed from Properties for registered resident units.' }, { status: 409 });
    const email = data.email?.trim() || null;
    const mobile = data.mobile?.trim() || null;
    if (data.signupEnabled && !email && !mobile && !flat.email && !flat.mobile) return NextResponse.json({ error: 'Add a registered email or mobile before enabling Owner signup.' }, { status: 400 });
    const row = (await rest<any[]>('Flat', { select: '*', id: 'eq.' + data.id }, { method: 'PATCH', body: JSON.stringify({ ...data, ownerName: data.ownerName !== undefined ? (data.ownerName.trim() || null) : undefined, email, mobile, updatedAt: new Date().toISOString() }) }))[0];
    return NextResponse.json(row);
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 400 ? 'Please check the owner details.' : status === 403 ? 'Forbidden' : 'Server error' }, { status });
  }
}
