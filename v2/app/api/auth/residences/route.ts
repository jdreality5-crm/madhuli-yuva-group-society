import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/auth';
import { appConfig } from '@/lib/config';

type PropertyRow = { id: string; type: string; name: string; propertyNumber: string; block: string | null };
type UnitRow = { id: string; propertyId: string; label: string; floorLabel: string; residentType: 'OWNER' | 'TENANT' | null; signupEnabled: boolean };

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('Supabase server configuration is missing');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function loadFromSupabase() {
  const client = supabaseAdmin();
  const { data: properties, error: propertyError } = await client
    .from('Property')
    .select('id,type,name,propertyNumber,block')
    .eq('societyId', appConfig.societyId)
    .eq('status', 'ACTIVE')
    .order('type', { ascending: true })
    .order('block', { ascending: true, nullsFirst: true })
    .order('propertyNumber', { ascending: true });

  if (propertyError) throw propertyError;

  const propertyIds = (properties || []).map((property) => property.id);
  if (!propertyIds.length) return [];

  const { data: units, error: unitError } = await client
    .from('PropertyUnit')
    .select('id,propertyId,label,floorLabel,residentType,signupEnabled')
    .in('propertyId', propertyIds)
    .eq('status', 'ACTIVE')
    .is('residentUserId', null)
    .order('floorNumber', { ascending: true })
    .order('label', { ascending: true });

  if (unitError) throw unitError;

  return (properties || []).map((property) => ({
    id: property.id,
    type: String(property.type).toUpperCase(),
    name: property.name,
    propertyNumber: property.propertyNumber,
    block: property.block ? String(property.block).toUpperCase() : null,
    units: (units || []).filter((unit) => unit.propertyId === property.id),
  }));
}

export async function GET() {
  try {
    let properties;
    try {
      properties = await loadFromSupabase();
    } catch (supabaseError) {
      console.error('[auth/residences] Supabase read failed; trying Prisma', supabaseError);
      const rows = await prisma.property.findMany({
        where: { societyId: appConfig.societyId, status: 'ACTIVE' },
        select: { id: true, type: true, name: true, propertyNumber: true, block: true },
        orderBy: [{ type: 'asc' }, { block: 'asc' }, { propertyNumber: 'asc' }],
      });
      const units = rows.length
        ? await prisma.propertyUnit.findMany({
            where: { propertyId: { in: rows.map((row) => row.id) }, status: 'ACTIVE', residentUserId: null },
            select: { id: true, propertyId: true, label: true, floorLabel: true, residentType: true, signupEnabled: true },
            orderBy: [{ floorNumber: 'asc' }, { label: 'asc' }],
          })
        : [];
      properties = rows.map((property) => ({
        ...property,
        type: String(property.type).toUpperCase(),
        block: property.block ? String(property.block).toUpperCase() : null,
        units: units.filter((unit) => unit.propertyId === property.id),
      }));
    }

    return NextResponse.json(
      { properties },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('[auth/residences] signup residence query failed', error);
    return NextResponse.json({ error: 'Unable to load signup residences' }, { status: 500 });
  }
}
