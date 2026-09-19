import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth';
import { appConfig } from '@/lib/config';

type PropertyRow = { id: string; type: string; name: string; propertyNumber: string; block: string | null };
type UnitRow = { id: string; propertyId: string; label: string; floorLabel: string; residentType: string | null; signupEnabled: boolean };

async function loadProperties() {
  try {
    return await prisma.property.findMany({
      where: { societyId: appConfig.societyId, status: 'ACTIVE' },
      include: {
        units: {
          where: { status: 'ACTIVE', residentUserId: null },
          select: { id: true, label: true, floorLabel: true, residentType: true, signupEnabled: true },
          orderBy: [{ floorNumber: 'asc' }, { label: 'asc' }],
        },
      },
      orderBy: [{ type: 'asc' }, { block: 'asc' }, { propertyNumber: 'asc' }],
    });
  } catch (error) {
    console.error('[auth/residences] ORM query failed, using direct PostgreSQL read', error);
    const properties = await prisma.$queryRaw<PropertyRow[]>`
      SELECT "id", "type"::text AS "type", "name", "propertyNumber", "block"
      FROM "Property"
      WHERE "societyId" = ${appConfig.societyId}
        AND "status"::text = 'ACTIVE'
      ORDER BY "type"::text ASC, "block" ASC NULLS FIRST, "propertyNumber" ASC
    `;
    const units = await prisma.$queryRaw<UnitRow[]>`
      SELECT "id", "propertyId", "label", "floorLabel", "residentType"::text AS "residentType", "signupEnabled"
      FROM "PropertyUnit"
      WHERE "propertyId" IN (
        SELECT "id" FROM "Property"
        WHERE "societyId" = ${appConfig.societyId}
          AND "status"::text = 'ACTIVE'
      )
        AND "status"::text = 'ACTIVE'
        AND "residentUserId" IS NULL
      ORDER BY "floorNumber" ASC, "label" ASC
    `;
    return properties.map((property) => ({
      ...property,
      type: property.type as 'APARTMENT' | 'TENAMENT',
      units: units.filter((unit) => unit.propertyId === property.id).map((unit) => ({
        id: unit.id,
        label: unit.label,
        floorLabel: unit.floorLabel,
        residentType: unit.residentType as 'OWNER' | 'TENANT' | null,
        signupEnabled: unit.signupEnabled,
      })),
    }));
  }
}

export async function GET() {
  try {
    const properties = await loadProperties();
    return NextResponse.json(
      { properties: properties.map(({ id, type, name, propertyNumber, block, units }) => ({ id, type, name, propertyNumber, block, units })) },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('[auth/residences] server error', error);
    return NextResponse.json({ error: 'Unable to load signup residences' }, { status: 500 });
  }
}
