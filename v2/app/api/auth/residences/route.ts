import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth';
import { appConfig } from '@/lib/config';

type PropertyRow = { id: string; type: string; name: string; propertyNumber: string; block: string | null };
type UnitRow = { id: string; propertyId: string; label: string; floorLabel: string; residentType: string | null; signupEnabled: boolean };

async function loadProperties(): Promise<Array<PropertyRow & { units: UnitRow[] }>> {
  const properties = await prisma.property.findMany({
    where: { societyId: appConfig.societyId, status: 'ACTIVE' },
    select: { id: true, type: true, name: true, propertyNumber: true, block: true },
    orderBy: [{ type: 'asc' }, { block: 'asc' }, { propertyNumber: 'asc' }],
  });

  try {
    const units = await prisma.propertyUnit.findMany({
      where: { propertyId: { in: properties.map((property) => property.id) }, status: 'ACTIVE', residentUserId: null },
      select: { id: true, propertyId: true, label: true, floorLabel: true, residentType: true, signupEnabled: true },
      orderBy: [{ floorNumber: 'asc' }, { label: 'asc' }],
    });
    return properties.map((property) => ({
      ...property,
      type: String(property.type),
      units: units.filter((unit) => unit.propertyId === property.id),
    }));
  } catch (error) {
    console.error('[auth/residences] unit query failed; returning properties without units', error);
    return properties.map((property) => ({ ...property, type: String(property.type), units: [] }));
  }
}

export async function GET() {
  try {
    const properties = await loadProperties();
    return NextResponse.json(
      { properties },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('[auth/residences] property query failed', error);
    return NextResponse.json({ error: 'Unable to load signup residences' }, { status: 500 });
  }
}
