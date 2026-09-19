import { NextResponse } from 'next/server';
import { appConfig } from '@/lib/config';

type PropertyRow = { id: string; type: string; name: string; propertyNumber: string; block: string | null };
type UnitRow = { id: string; propertyId: string; label: string; floorLabel: string; residentType: 'OWNER' | 'TENANT' | null; signupEnabled: boolean };

async function supabaseRest<T>(table: string, params: Record<string, string>) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('Supabase server configuration is missing');
  const url = new URL(base + '/rest/v1/' + table);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url.toString(), {
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error('Supabase ' + table + ' request failed (' + response.status + ')' + (detail ? ': ' + detail.slice(0, 300) : ''));
  }
  return response.json() as Promise<T>;
}

export async function GET() {
  try {
    const properties = await supabaseRest<PropertyRow[]>('Property', {
      select: 'id,type,name,propertyNumber,block',
      societyId: 'eq.' + appConfig.societyId,
      status: 'eq.ACTIVE',
      order: 'type.asc,block.asc.nullslast,propertyNumber.asc',
    });

    const propertyIds = properties.map((property) => property.id);
    const reservationCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const pendingUsers = await supabaseRest<Array<{ id: string }>>('User', {
      select: 'id',
      societyId: 'eq.' + appConfig.societyId,
      status: 'eq.INACTIVE',
      emailVerified: 'eq.false',
      createdAt: 'gte.' + reservationCutoff,
    });
    const pendingIds = pendingUsers.map((user) => user.id);
    const unitParams: Record<string, string> = {
      select: 'id,propertyId,label,floorLabel,residentType,signupEnabled',
      propertyId: 'in.(' + propertyIds.join(',') + ')',
      status: 'eq.ACTIVE',
      order: 'floorNumber.asc,label.asc',
    };
    if (pendingIds.length) {
      unitParams.or = 'residentUserId.is.null,residentUserId.not.in.(' + pendingIds.join(',') + ')';
    } else {
      unitParams.residentUserId = 'is.null';
    }
    const units = propertyIds.length
      ? await supabaseRest<UnitRow[]>('PropertyUnit', unitParams)
      : [];

    return NextResponse.json(
      {
        properties: properties.map((property) => ({
          id: property.id,
          type: String(property.type).toUpperCase(),
          name: property.name,
          propertyNumber: property.propertyNumber,
          block: property.block ? String(property.block).toUpperCase() : null,
          units: units.filter((unit) => unit.propertyId === property.id),
        })),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('[auth/residences] signup residence query failed', error);
    return NextResponse.json({ error: 'Unable to load signup residences' }, { status: 500 });
  }
}
