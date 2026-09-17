import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth';
import { appConfig } from '@/lib/config';

export async function GET() {
  try {
    const properties = await prisma.property.findMany({
      where: { societyId: appConfig.societyId, status: 'ACTIVE' },
      include: {
        units: {
          where: { status: 'ACTIVE', signupEnabled: true, residentUserId: null },
          select: { id: true, label: true, floorLabel: true, residentType: true, signupEnabled: true },
          orderBy: [{ floorNumber: 'asc' }, { label: 'asc' }],
        },
      },
      orderBy: [{ type: 'asc' }, { block: 'asc' }, { propertyNumber: 'asc' }],
    });
    return NextResponse.json({ properties: properties.map(({ id, type, name, propertyNumber, block, units }) => ({ id, type, name, propertyNumber, block, units })) });
  } catch (error) {
    console.error('[auth/residences] server error', error);
    return NextResponse.json({ error: 'Unable to load signup residences' }, { status: 500 });
  }
}
