import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth';
import { appConfig } from '@/lib/config';

type PropertyRow = { id: string; type: string; name: string; propertyNumber: string; block: string | null };
type UnitRow = { id: string; propertyId: string; label: string; floorLabel: string; residentType: string | null; signupEnabled: boolean };

export async function GET() {
  try {
    const properties = await prisma.$queryRaw<PropertyRow[]>\`
      SELECT "id", "type"::text AS "type", "name", "propertyNumber", "block"
      FROM "Property"
      WHERE "societyId" = ${appConfig.societyId}
        AND "status"::text = 'ACTIVE'
      ORDER BY "type"::text ASC, "block" ASC NULLS FIRST, "propertyNumber" ASC
    \`;

    const units = properties.length
      ? await prisma.$queryRaw<UnitRow[]>\`
          SELECT "id", "propertyId", "label", "floorLabel", "residentType"::text AS "residentType", "signupEnabled"
          FROM "PropertyUnit"
          WHERE "propertyId" IN (${prisma.join(properties.map((property) => property.id))})
            AND "status"::text = 'ACTIVE'
            AND "residentUserId" IS NULL
          ORDER BY "floorNumber" ASC, "label" ASC
        \`
      : [];

    return NextResponse.json(
      {
        properties: properties.map((property) => ({
          ...property,
          type: property.type.toUpperCase(),
          block: property.block?.toUpperCase() || null,
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
