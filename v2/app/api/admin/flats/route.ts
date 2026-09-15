import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireOrganizer } from '@/lib/auth';

const schema = z.object({
  flatNumber: z.string().trim().min(1).max(50),
  ownerName: z.string().trim().max(120).optional(),
  mobile: z.string().trim().max(30).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export async function GET() {
  try {
    const s = await requireOrganizer();
    const rows = await prisma.flat.findMany({ where: { societyId: s.societyId }, orderBy: { flatNumber: 'asc' } });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error && e.message === 'FORBIDDEN' ? 'Forbidden' : 'Server error' }, { status: e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500 });
  }
}

export async function POST(req: Request) {
  try {
    const s = await requireOrganizer();
    const data = schema.parse(await req.json());
    const flatNumber = data.flatNumber.trim();
    const existing = await prisma.flat.findFirst({ where: { societyId: s.societyId, flatNumber: { equals: flatNumber, mode: 'insensitive' } }, select: { id: true } });
    if (existing) return NextResponse.json({ error: 'This flat number already exists.' }, { status: 409 });

    const row = await prisma.flat.create({
      data: {
        flatNumber,
        ownerName: data.ownerName?.trim() || null,
        mobile: data.mobile?.trim() || null,
        email: data.email?.trim() || null,
        status: data.status,
        societyId: s.societyId,
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'Please check the flat and owner details.' }, { status: 400 });
    return NextResponse.json({ error: e instanceof Error && e.message === 'FORBIDDEN' ? 'Forbidden' : 'Server error' }, { status: e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500 });
  }
}
