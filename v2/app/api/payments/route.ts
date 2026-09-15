import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireSession } from '@/lib/auth';

const createSchema = z.object({ paymentAccountId: z.string().min(1), eventId: z.string().optional().or(z.literal('')), amountPaise: z.string().regex(/^\d+$/) });
const updateSchema = z.object({ transactionId: z.string().trim().min(4).max(120), screenshotUrl: z.string().url().optional().or(z.literal('')), notes: z.string().trim().max(500).optional().or(z.literal('')) });

export async function GET() {
  try {
    const session = await requireSession();
    const where = session.role === 'OWNER' ? { societyId: session.societyId, ownerUserId: session.id } : { societyId: session.societyId };
    const payments = await prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, include: { paymentAccount: { select: { displayName: true, upiId: true, purpose: true, qrImageUrl: true } }, event: { select: { id: true, title: true, gujaratiTitle: true } }, ownerUser: { select: { id: true, name: true, email: true } }, verifiedBy: { select: { id: true, name: true, role: true } } } });
    return NextResponse.json({ payments });
  } catch (e) { const status = e instanceof Error && e.message === 'UNAUTHORIZED' ? 401 : 500; return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Server error' }, { status }); }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (session.role !== 'OWNER') return NextResponse.json({ error: 'Only Flat Owners can initiate a payment.' }, { status: 403 });
    const body = createSchema.parse(await req.json());
    const amountPaise = BigInt(body.amountPaise);
    if (amountPaise <= 0n) return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    const account = await prisma.paymentAccount.findFirst({ where: { id: body.paymentAccountId, societyId: session.societyId, status: 'ACTIVE' } });
    if (!account) return NextResponse.json({ error: 'Payment account not found.' }, { status: 404 });
    let eventId = body.eventId || null;
    if (eventId && !(await prisma.event.findFirst({ where: { id: eventId, societyId: session.societyId } }))) eventId = null;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const payment = await prisma.payment.create({ data: { societyId: session.societyId, ownerUserId: session.id, paymentAccountId: account.id, eventId, amountPaise, expiresAt } });
    return NextResponse.json({ payment: { ...payment, amountPaise: payment.amountPaise.toString() } }, { status: 201 });
  } catch (e) { const status = e instanceof z.ZodError ? 400 : e instanceof Error && e.message === 'UNAUTHORIZED' ? 401 : 500; return NextResponse.json({ error: status === 400 ? 'Invalid payment details.' : status === 401 ? 'Unauthorized' : 'Server error' }, { status }); }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    if (session.role !== 'OWNER') return NextResponse.json({ error: 'Only the paying Flat Owner can submit payment evidence.' }, { status: 403 });
    const body = await req.json();
    const paymentId = String(body.paymentId || '');
    const data = updateSchema.parse(body);
    const payment = await prisma.payment.findFirst({ where: { id: paymentId, societyId: session.societyId, ownerUserId: session.id } });
    if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    if (payment.status !== 'PENDING') return NextResponse.json({ error: 'This payment is no longer editable.' }, { status: 409 });
    if (payment.expiresAt < new Date()) return NextResponse.json({ error: 'The 10-minute payment session has expired. Start a new payment.' }, { status: 409 });
    const updated = await prisma.payment.update({ where: { id: payment.id }, data: { transactionId: data.transactionId, screenshotUrl: data.screenshotUrl || null, notes: data.notes || null } });
    return NextResponse.json({ payment: { ...updated, amountPaise: updated.amountPaise.toString() } });
  } catch (e) { const status = e instanceof z.ZodError ? 400 : e instanceof Error && e.message === 'UNAUTHORIZED' ? 401 : 500; return NextResponse.json({ error: status === 400 ? 'Invalid transaction details.' : status === 401 ? 'Unauthorized' : 'Server error' }, { status }); }
}
