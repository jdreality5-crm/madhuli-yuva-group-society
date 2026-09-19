import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth';
import { appConfig } from '@/lib/config';

export async function GET() {
  try {
    const properties = await prisma.property.findMany({
      where: { societyId: appConfig.societyId, status: 'ACTIVE' },
      select: {
        id: true,
        type: true,
        name: true,
        propertyNumber: true,
        block: true,
      },
      orderBy: [{ type: 'asc' }, { block: 'asc' }, { propertyNumber: 'asc' }],
    });

    let units: Array<{
      id: string;
      propertyId: string;
      label: string;
      floorLabel: string;
      residentType: 'OWNER' | 'TENANT' | null;
      signupEnabled: boolean;
    }> = [];

    if (properties.length > 0) {
      try {
        units = await prisma.propertyUnit.findMany({
          where: {
            propertyId: { in: properties.map((property) => property.id) },
            status: 'ACTIVE',
            residentUserId: null,
          },
          select: {
            id: true,
            propertyId: true,
            label: true,
            floorLabel: true,
            residentType: true,
            signupEnabled: true,
          },
          orderBy: [{ floorNumber: 'asc' }, { label: 'asc' }],
        });
      } catch (error) {
        console.error('[auth/residences] unit query failed', error);
      }
    }

    return NextResponse.json(
      {
        properties: properties.map((property) => ({
          id: property.id,
          type: String(property.type).toUpperCase(),
          name: property.name,
          propertyNumber: property.propertyNumber,
          block: property.block ? String(property.block).toUpperCase() : null,
          units: units
            .filter((unit) => unit.propertyId === property.id)
            .map(({ id, label, floorLabel, residentType, signupEnabled }) => ({
              id,
              label,
              floorLabel,
              residentType,
              signupEnabled,
            })),
        })),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('[auth/residences] property query failed', error);
    return NextResponse.json({ error: 'Unable to load signup residences' }, { status: 500 });
  }
}
