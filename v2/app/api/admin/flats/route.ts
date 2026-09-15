import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireOrganizer } from '@/lib/auth';

const schema = z.object({ flatNumber: z.string().trim().min(1).max(50), ownerName: z.string().trim().max(120).optional(), mobile: z.string().trim().max(30).optional(), email: z.string().email().optional().or(z.literal('')), status: z.enum(['ACTIVE','INACTIVE']).default('ACTIVE') });

export async function GET() {
  try { const s = await requireOrganizer(); const rows = await prisma.flat.findMany({ where: { societyId: s.societyId }, orderBy: { flatNumber: 'asc' } }); return NextResponse.json(rows); }
  catch (e) { return NextResponse.json({ error: e instanceof Error && e.message === 'FORBIDDEN' ? 'Forbidden' : 'Server error' }, { status: 403 }); }
}

export async function POST(req: Request) {
  try {
    const s = await requireOrganizer(); const data = schema.parse(await req.json());
    const row = await prisma.flat.create({ data: { ...data, societyId: s.societyId, email: data.email || null } });
    return NextResponse.json(row, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error && e.message === 'FORBIDDEN' ? 'Forbidden' : 'Invalid request' }, { status: 403 }); }
}
