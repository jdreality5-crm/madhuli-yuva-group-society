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
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(users);
  } catch (error) {
    const status = error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : 'Server error' }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireMasterAdmin();
    const body = actionSchema.parse(await req.json());
    const user = await prisma.user.findFirst({ where: { id: body.id, societyId: session.societyId, role: 'OWNER' } });
    if (!user) return NextResponse.json({ error: 'Owner signup not found.' }, { status: 404 });
    if (user.approvalStatus !== 'PENDING') return NextResponse.json({ error: 'This signup has already been reviewed.' }, { status: 409 });

    if (body.action === 'REJECT') {
      await prisma.$transaction([
        prisma.verificationToken.deleteMany({ where: { userId: user.id } }),
        prisma.user.update({ where: { id: user.id }, data: { approvalStatus: 'REJECTED', status: 'INACTIVE' } }),
      ]);
      return NextResponse.json({ approved: false, rejected: true });
    }

    await prisma.user.update({ where: { id: user.id }, data: { approvalStatus: 'APPROVED', status: 'INACTIVE', emailVerified: false } });
    return NextResponse.json({ approved: true, otpRequired: true, message: 'Owner approved. The owner can now use Resend to receive an OTP.' });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid approval request.' }, { status: 400 });
    const status = error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : 'Server error' }, { status });
  }
}
