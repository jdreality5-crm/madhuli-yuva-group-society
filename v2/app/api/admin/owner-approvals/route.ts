import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireMasterAdmin } from '@/lib/auth';

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT']),
});

export async function GET() {
  try {
    const session = await requireMasterAdmin();
    const users = await prisma.user.findMany({
      where: { societyId: session.societyId, role: 'OWNER', approvalStatus: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        status: true,
        approvalStatus: true,
        emailVerified: true,
        flat: { select: { id: true, flatNumber: true, ownerName: true, email: true, mobile: true } },
        createdAt: true,
      },
    });
    return NextResponse.json({ users });
  } catch (e) {
    const status = e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? 'Master Admin access required' : 'Server error' }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireMasterAdmin();
    const body = actionSchema.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: body.id, societyId: session.societyId, role: 'OWNER' },
        select: { id: true, email: true, approvalStatus: true, status: true, emailVerified: true },
      });
      if (!user) return { kind: 'NOT_FOUND' as const };
      if (user.approvalStatus !== 'PENDING') return { kind: 'ALREADY_PROCESSED' as const };

      const nextStatus = body.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { approvalStatus: nextStatus, status: body.action === 'APPROVE' ? 'INACTIVE' : 'INACTIVE' },
        select: { id: true, email: true, approvalStatus: true, status: true, emailVerified: true },
      });

      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: body.action,
          module: 'OWNER_APPROVAL',
          recordId: user.id,
          details: `${body.action === 'APPROVE' ? 'Approved' : 'Rejected'} Owner ${user.email}`,
        },
      });
      return { kind: 'OK' as const, user: updated };
    });

    if (result.kind === 'NOT_FOUND') return NextResponse.json({ error: 'Owner not found.' }, { status: 404 });
    if (result.kind === 'ALREADY_PROCESSED') return NextResponse.json({ error: 'Owner approval request has already been processed.' }, { status: 409 });
    return NextResponse.json({ user: result.user });
  } catch (e) {
    const status = e instanceof z.ZodError ? 400 : e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 400 ? 'Invalid approval request.' : status === 403 ? 'Master Admin access required' : 'Server error' }, { status });
  }
}
