import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireOrganizer } from '@/lib/auth';

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
    const s = await requireOrganizer();
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT id, "societyId", "flatNumber", "ownerName", mobile, email, status, "createdAt", "updatedAt", "signupEnabled"
      FROM public."Flat" WHERE "societyId"=${s.societyId} ORDER BY "flatNumber" ASC
    `;
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
    if (data.signupEnabled && !data.email?.trim() && !data.mobile?.trim()) return NextResponse.json({ error: 'Add a registered email or mobile before enabling Owner signup.' }, { status: 400 });
    const row = await prisma.flat.create({ data: { flatNumber, ownerName: data.ownerName?.trim() || null, mobile: data.mobile?.trim() || null, email: data.email?.trim() || null, status: data.status, societyId: s.societyId } });
    await prisma.$executeRaw`UPDATE public."Flat" SET "signupEnabled"=${data.signupEnabled} WHERE id=${row.id}`;
    return NextResponse.json({ ...row, signupEnabled: data.signupEnabled }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'Please check the flat and owner details.' }, { status: 400 });
    return NextResponse.json({ error: e instanceof Error && e.message === 'FORBIDDEN' ? 'Forbidden' : 'Server error' }, { status: e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const s = await requireOrganizer();
    const body = z.object({ id: z.string().min(1), ownerName: z.string().trim().max(120).optional(), mobile: z.string().trim().max(30).optional(), email: z.string().trim().email().optional().or(z.literal('')), status: z.enum(['ACTIVE', 'INACTIVE']).optional(), signupEnabled: z.boolean() }).parse(await req.json());
    const flat = await prisma.flat.findFirst({ where: { id: body.id, societyId: s.societyId }, select: { id: true, email: true, mobile: true } });
    if (!flat) return NextResponse.json({ error: 'Flat not found.' }, { status: 404 });
    const email = body.email?.trim() || null;
    const mobile = body.mobile?.trim() || null;
    if (body.signupEnabled && !email && !mobile && !flat.email && !flat.mobile) return NextResponse.json({ error: 'Add a registered email or mobile before enabling Owner signup.' }, { status: 400 });
    const updated = await prisma.flat.update({ where: { id: flat.id }, data: { ...(body.ownerName !== undefined ? { ownerName: body.ownerName.trim() || null } : {}), ...(body.mobile !== undefined ? { mobile } : {}), ...(body.email !== undefined ? { email } : {}), ...(body.status ? { status: body.status } : {}) } });
    await prisma.$executeRaw`UPDATE public."Flat" SET "signupEnabled"=${body.signupEnabled} WHERE id=${flat.id} AND "societyId"=${s.societyId}`;
    return NextResponse.json({ ...updated, signupEnabled: body.signupEnabled });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'Please check the owner details.' }, { status: 400 });
    return NextResponse.json({ error: e instanceof Error && e.message === 'FORBIDDEN' ? 'Forbidden' : 'Server error' }, { status: e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500 });
  }
}
