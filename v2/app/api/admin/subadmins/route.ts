import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma, requireMasterAdmin } from '@/lib/auth';
import { SUBADMIN_PROFILE_TYPES, SUBADMIN_PROFILE_PERMISSIONS } from '@/app/subadmin-profiles';

const MAX_SUBADMINS = 6;
const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().transform(v => v.toLowerCase()),
  mobile: z.string().trim().max(20).optional().or(z.literal('')),
  password: z.string().min(8).max(100),
  profileType: z.enum(SUBADMIN_PROFILE_TYPES).default('MANAGER'),
});

export async function GET() {
  try {
    const session = await requireMasterAdmin();
    const users = await prisma.user.findMany({
      where: { societyId: session.societyId, role: 'ORGANIZER' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, mobile: true, status: true, createdAt: true, updatedAt: true, permissions: true },
    });
    return NextResponse.json({ max: MAX_SUBADMINS, count: users.length, users });
  } catch (e) {
    const status = e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? 'Master Admin access required' : 'Server error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireMasterAdmin();
    const body = createSchema.parse(await req.json());
    const passwordHash = await bcrypt.hash(body.password, 12);
    try {
      const user = await prisma.$transaction(async tx => {
        const count = await tx.user.count({ where: { societyId: session.societyId, role: 'ORGANIZER' } });
        if (count >= MAX_SUBADMINS) throw new Error('MAX_SUBADMINS');
        const existing = await tx.user.findUnique({ where: { email: body.email } });
        if (existing) throw new Error('EMAIL_EXISTS');
        const created = await tx.user.create({ data: { name: body.name, email: body.email, mobile: body.mobile || null, passwordHash, role: 'ORGANIZER', societyId: session.societyId, permissions: [...SUBADMIN_PROFILE_PERMISSIONS[body.profileType]] } });
        await tx.auditLog.create({ data: { userId: session.id, action: 'CREATE', module: 'SUBADMIN', recordId: created.id, details: `Created Sub Admin ${created.email}` } });
        return created;
      }, { isolationLevel: 'Serializable' });
      return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, mobile: user.mobile, status: user.status, permissions: user.permissions }, max: MAX_SUBADMINS }, { status: 201 });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'MAX_SUBADMINS') return NextResponse.json({ error: `Maximum ${MAX_SUBADMINS} Sub Admin profiles allowed.` }, { status: 409 });
      if (code === 'EMAIL_EXISTS') return NextResponse.json({ error: 'Email already exists.' }, { status: 409 });
      if (typeof error === 'object' && error && 'code' in error && String((error as { code?: unknown }).code) === 'P2034') return NextResponse.json({ error: 'Another Sub Admin update is in progress. Please try again.' }, { status: 409 });
      throw error;
    }
  } catch (e) {
    const status = e instanceof z.ZodError ? 400 : e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 400 ? 'Invalid profile details.' : status === 403 ? 'Master Admin access required' : 'Server error' }, { status });
  }
}
