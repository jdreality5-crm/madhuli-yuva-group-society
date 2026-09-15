import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireOrganizer } from '@/lib/auth';

const schema = z.object({ paymentId: z.string().min(1), action: z.enum(['VERIFY', 'REJECT']), rejectionReason: z.string().trim().max(300).optional().or(z.literal('')) });

export async function GET() {
  try {
    const session = await requireOrganizer();
    const payments = await prisma.payment.findMany({ where: { societyId: session.societyId }, orderBy: { createdAt: 'desc' }, include: { paymentAccount: { select: { displayName: true, upiId: true, purpose: true } }, event: { select: { title: true, gujaratiTitle: true } }, ownerUser: { select: { name: true, email: true, mobile: true, flatId: true } }, verifiedBy: { select: { name: true, role: true } } } });
    return NextResponse.json({ payments: payments.map(p => ({ ...p, amountPaise: p.amountPaise.toString() })) });
  } catch (e) { const status = e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500; return NextResponse.json({ error: status === 403 ? 'Organizer access required' : 'Server error' }, { status }); }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireOrganizer();
    const body = schema.parse(await req.json());
    const payment = await prisma.payment.findFirst({ where: { id: body.paymentId, societyId: session.societyId } });
    if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    if (payment.status !== 'PENDING') return NextResponse.json({ error: 'Payment has already been reviewed.' }, { status: 409 });
    const updated = await prisma.payment.update({ where: { id: payment.id }, data: body.action === 'VERIFY' ? { status: 'VERIFIED', verifiedAt: new Date(), verifiedById: session.id, rejectionReason: null } : { status: 'REJECTED', verifiedAt: null, verifiedById: session.id, rejectionReason: body.rejectionReason || 'Payment evidence was rejected.' } });
    await prisma.auditLog.create({ data: { userId: session.id, action: body.action, module: 'PAYMENT', recordId: payment.id, details: body.action === 'VERIFY' ? 'UPI payment verified' : 'UPI payment rejected' } });
    return NextResponse.json({ payment: { ...updated, amountPaise: updated.amountPaise.toString() } });
  } catch (e) { const status = e instanceof z.ZodError ? 400 : e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500; return NextResponse.json({ error: status === 400 ? 'Invalid review request.' : status === 403 ? 'Organizer access required' : 'Server error' }, { status }); }
}
