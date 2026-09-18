import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma, requireMasterAdmin, SUBADMIN_PERMISSIONS } from '@/lib/auth';

const schema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().email().transform(v => v.toLowerCase()).optional(),
  mobile: z.string().trim().max(20).optional().or(z.literal('')),
  password: z.string().min(8).max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  permissions: z.array(z.enum(SUBADMIN_PERMISSIONS)).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireMasterAdmin();
    const { id } = await params;
    const body = schema.parse(await req.json());
    const target = await prisma.user.findFirst({ where: { id, societyId: session.societyId, role: 'ORGANIZER' } });
    if (!target) return NextResponse.json({ error: 'Sub Admin not found.' }, { status: 404 });
    const data: { name?: string; email?: string; mobile?: string | null; passwordHash?: string; status?: 'ACTIVE' | 'INACTIVE'; permissions?: string[] } = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.email !== undefined) data.email = body.email;
    if (body.mobile !== undefined) data.mobile = body.mobile || null;
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 12);
    if (body.status) data.status = body.status;
    if (body.permissions !== undefined) data.permissions = [...new Set(body.permissions)];
    if (data.email && data.email !== target.email) {
      const duplicate = await prisma.user.findUnique({ where: { email: data.email } });
      if (duplicate) return NextResponse.json({ error: 'Email already exists.' }, { status: 409 });
    }
    const user = await prisma.user.update({ where: { id }, data, select: { id: true, name: true, email: true, mobile: true, status: true, permissions: true, updatedAt: true } });
    await prisma.auditLog.create({ data: { userId: session.id, action: 'UPDATE', module: 'SUBADMIN', recordId: user.id, details: `Updated Sub Admin ${user.email}` } });
    return NextResponse.json({ user });
  } catch (e) {
    const status = e instanceof z.ZodError ? 400 : e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 400 ? 'Invalid profile details.' : status === 403 ? 'Master Admin access required' : 'Server error' }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireMasterAdmin();
    const { id } = await params;
    const target = await prisma.user.findFirst({ where: { id, societyId: session.societyId, role: 'ORGANIZER' } });
    if (!target) return NextResponse.json({ error: 'Sub Admin not found.' }, { status: 404 });
    await prisma.user.update({ where: { id }, data: { status: 'INACTIVE' } });
    await prisma.auditLog.create({ data: { userId: session.id, action: 'DEACTIVATE', module: 'SUBADMIN', recordId: id, details: `Deactivated Sub Admin ${target.email}` } });
    return NextResponse.json({ success: true });
  } catch (e) {
    const status = e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? 'Master Admin access required' : 'Server error' }, { status });
  }
}
