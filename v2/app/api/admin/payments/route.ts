import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireSubAdminPermission } from '@/lib/auth';

const schema = z.object({
  paymentId: z.string().min(1),
  action: z.enum(['VERIFY', 'REJECT']),
  rejectionReason: z.string().trim().max(300).optional().or(z.literal('')),
});

export async function GET() {
  try {
    const session = await requireSubAdminPermission('PAYMENTS');
    const payments = await prisma.payment.findMany({
      where: { societyId: session.societyId },
      orderBy: { createdAt: 'desc' },
      include: {
        paymentAccount: { select: { displayName: true, upiId: true, purpose: true } },
        bill: { select: { id: true, type: true, amountPaise: true, paymentStatus: true, category: true, vendor: true, date: true } },
        event: { select: { title: true, gujaratiTitle: true } },
        ownerUser: { select: { name: true, email: true, mobile: true, flatId: true, unit: { select: { label: true, property: { select: { name: true, propertyNumber: true, block: true } } } } } },
        verifiedBy: { select: { name: true, role: true } },
      },
    });
    return NextResponse.json({ payments: payments.map(p => ({ ...p, amountPaise: p.amountPaise.toString(), bill: p.bill ? { ...p.bill, amountPaise: p.bill.amountPaise.toString() } : null })) });
  } catch (e) {
    const status = e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? 'Organizer access required' : 'Server error' }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSubAdminPermission('PAYMENTS');
    const body = schema.parse(await req.json());

    const result = await prisma.$transaction(async tx => {
      const payment = await tx.payment.findFirst({
        where: { id: body.paymentId, societyId: session.societyId },
        include: { ownerUser: true, paymentAccount: true },
      });
      if (!payment) return { error: 'Payment not found.', status: 404 as const };
      if (payment.status !== 'PENDING') return { error: 'Payment has already been reviewed.', status: 409 as const };

      // Claim the pending payment atomically. A concurrent reviewer will update zero rows.
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, societyId: session.societyId, status: 'PENDING' },
        data: body.action === 'VERIFY'
          ? { status: 'VERIFIED', verifiedAt: new Date(), verifiedById: session.id, rejectionReason: null }
          : { status: 'REJECTED', verifiedAt: null, verifiedById: session.id, rejectionReason: body.rejectionReason || 'Payment evidence was rejected.' },
      });

      if (claimed.count !== 1) return { error: 'Payment has already been reviewed.', status: 409 as const };

      if (body.action === 'VERIFY') {
        if (payment.billId) {
          await tx.bill.updateMany({ where: { id: payment.billId, societyId: session.societyId, paymentStatus: { not: 'PAID' } }, data: { paymentStatus: 'PAID' } });
        }
        await tx.income.create({
          data: {
            societyId: payment.societyId,
            eventId: payment.eventId,
            date: new Date(),
            category: 'UPI Payment',
            description: payment.paymentAccount.purpose,
            receivedFrom: payment.ownerUser.name,
            amountPaise: payment.amountPaise,
            paymentMethod: 'UPI',
            referenceNumber: payment.transactionId || undefined,
            notes: `Verified payment ${payment.id}`,
            createdById: session.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: body.action,
          module: 'PAYMENT',
          recordId: payment.id,
          details: body.action === 'VERIFY' ? 'UPI payment verified and added to Income' : 'UPI payment rejected',
        },
      });

      const updated = await tx.payment.findUnique({ where: { id: payment.id } });
      return { payment: updated, status: 200 as const };
    });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    if (!result.payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    return NextResponse.json({ payment: { ...result.payment, amountPaise: result.payment.amountPaise.toString() } });
  } catch (e) {
    const status = e instanceof z.ZodError ? 400 : e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 400 ? 'Invalid review request.' : status === 403 ? 'Organizer access required' : 'Server error' }, { status });
  }
}
