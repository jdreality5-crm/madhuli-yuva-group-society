import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireAdmin, requireMasterAdmin } from '@/lib/auth';

const schema = z.object({
  displayName: z.string().trim().min(2).max(100),
  upiId: z.string().trim().max(100).optional().or(z.literal('')),
  qrImageUrl: z.string().url().optional().or(z.literal('')),
  purpose: z.string().trim().min(2).max(200),
  instructions: z.string().trim().max(500).optional().or(z.literal('')),
  ownerUserId: z.string().optional().or(z.literal('')),
});

export async function GET() {
  try {
    const session = await requireAdmin();
    const accounts = await prisma.paymentAccount.findMany({ where: { societyId: session.societyId }, orderBy: { createdAt: 'asc' }, include: { ownerUser: { select: { id: true, name: true, role: true } } } });
    return NextResponse.json({ accounts });
  } catch (e) {
    const status = e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? 'Admin access required' : 'Server error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireMasterAdmin();
    const body = schema.parse(await req.json());
    let ownerUserId = body.ownerUserId || null;
    if (ownerUserId) {
      const owner = await prisma.user.findFirst({ where: { id: ownerUserId, societyId: session.societyId, role: { in: ['MASTER_ADMIN', 'ORGANIZER'] }, status: 'ACTIVE' } });
      if (!owner) return NextResponse.json({ error: 'Invalid payment account owner.' }, { status: 400 });
    } else ownerUserId = session.id;
    const account = await prisma.paymentAccount.create({ data: { societyId: session.societyId, ownerUserId, displayName: body.displayName, upiId: body.upiId || null, qrImageUrl: body.qrImageUrl || null, purpose: body.purpose, instructions: body.instructions || null } });
    await prisma.auditLog.create({ data: { userId: session.id, action: 'CREATE', module: 'PAYMENT_ACCOUNT', recordId: account.id, details: `Created payment account ${account.displayName}` } });
    return NextResponse.json({ account }, { status: 201 });
  } catch (e) {
    const status = e instanceof z.ZodError ? 400 : e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 400 ? 'Invalid payment account details.' : status === 403 ? 'Master Admin access required' : 'Server error' }, { status });
  }
}
