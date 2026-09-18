import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireSession } from '@/lib/auth';
import { createSignedFileUrl, getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase-admin';

const screenshot = z.string().trim().max(4000000).refine(v => v === '' || v.startsWith('data:image/'), 'Invalid screenshot reference');
const createSchema = z.object({ paymentAccountId: z.string().min(1), eventId: z.string().optional().or(z.literal('')), billId: z.string().optional().or(z.literal('')), amountPaise: z.string().regex(/^\d+$/) });
const updateSchema = z.object({ transactionId: z.string().trim().min(4).max(120), screenshotUrl: screenshot.optional(), notes: z.string().trim().max(500).optional().or(z.literal('')) });

async function storeScreenshot(value: string, societyId: string) {
  if (!value) return null;
  const match = value.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error('INVALID_SCREENSHOT');
  const contentType = match[1];
  const extension = match[2] === 'jpeg' ? 'jpg' : match[2];
  const buffer = Buffer.from(match[3], 'base64');
  if (buffer.length > 5 * 1024 * 1024) throw new Error('SCREENSHOT_TOO_LARGE');
  const path = `${societyId}/payment-screenshots/${crypto.randomUUID()}.${extension}`;
  const { error } = await getSupabaseAdmin().storage.from(STORAGE_BUCKET).upload(path, buffer, { contentType, upsert: false, cacheControl: '3600' });
  if (error) throw error;
  return path;
}

async function removeStoredFile(path: string | null) {
  if (!path) return;
  await getSupabaseAdmin().storage.from(STORAGE_BUCKET).remove([path]);
}

export async function GET() {
  try {
    const session = await requireSession();
    const where = session.role === 'OWNER' ? { societyId: session.societyId, ownerUserId: session.id } : { societyId: session.societyId };
    const payments = await prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, include: { paymentAccount: { select: { displayName: true, upiId: true, purpose: true, qrImageUrl: true } }, event: { select: { id: true, title: true, gujaratiTitle: true } }, ownerUser: { select: { id: true, name: true, email: true } }, verifiedBy: { select: { id: true, name: true, role: true } } } });
    const result = await Promise.all(payments.map(async p => ({ ...p, screenshotUrl: p.screenshotUrl ? await createSignedFileUrl(p.screenshotUrl) : null, paymentAccount: { ...p.paymentAccount, qrImageUrl: p.paymentAccount.qrImageUrl ? await createSignedFileUrl(p.paymentAccount.qrImageUrl) : null } })));
    return NextResponse.json({ payments: result });
  } catch (e) { const status = e instanceof Error && e.message === 'UNAUTHORIZED' ? 401 : 500; return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Server error' }, { status }); }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (session.role !== 'OWNER') return NextResponse.json({ error: 'Only Flat Owners can initiate a payment.' }, { status: 403 });
    const body = createSchema.parse(await req.json());
    const amountPaise = BigInt(body.amountPaise);
    if (amountPaise <= 0n) return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    let billId = body.billId || null;
    if (billId) {
      const bill = await prisma.bill.findFirst({ where: { id: billId, societyId: session.societyId, propertyUnit: { residentUserId: session.id, property: { societyId: session.societyId } } }, select: { id: true, amountPaise: true } });
      if (!bill) return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
      if (bill.amountPaise !== amountPaise) return NextResponse.json({ error: 'Payment amount must match the bill amount.' }, { status: 400 });
    }
    const account = await prisma.paymentAccount.findFirst({ where: { id: body.paymentAccountId, societyId: session.societyId, status: 'ACTIVE' } });
    if (!account) return NextResponse.json({ error: 'Payment account not found.' }, { status: 404 });
    let eventId = body.eventId || null;
    if (eventId && !(await prisma.event.findFirst({ where: { id: eventId, societyId: session.societyId } }))) eventId = null;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const payment = await prisma.payment.create({ data: { societyId: session.societyId, ownerUserId: session.id, paymentAccountId: account.id, eventId, billId, amountPaise, expiresAt } });
    return NextResponse.json({ payment: { ...payment, amountPaise: payment.amountPaise.toString() } }, { status: 201 });
  } catch (e) { const status = e instanceof z.ZodError ? 400 : e instanceof Error && e.message === 'UNAUTHORIZED' ? 401 : 500; return NextResponse.json({ error: status === 400 ? 'Invalid payment details.' : status === 401 ? 'Unauthorized' : 'Server error' }, { status }); }
}

export async function PATCH(req: Request) {
  let uploadedScreenshot: string | null = null;
  try {
    const session = await requireSession();
    if (session.role !== 'OWNER') return NextResponse.json({ error: 'Only the paying Flat Owner can submit payment evidence.' }, { status: 403 });
    const body = await req.json();
    const paymentId = String(body.paymentId || '');
    const data = updateSchema.parse(body);
    const payment = await prisma.payment.findFirst({ where: { id: paymentId, societyId: session.societyId, ownerUserId: session.id }, select: { id: true, status: true, expiresAt: true, screenshotUrl: true } });
    if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    if (payment.status !== 'PENDING') return NextResponse.json({ error: 'This payment is no longer editable.' }, { status: 409 });
    const now = new Date();
    if (payment.expiresAt < now) return NextResponse.json({ error: 'The 10-minute payment session has expired. Start a new payment.' }, { status: 409 });

    uploadedScreenshot = await storeScreenshot(data.screenshotUrl || '', session.societyId);
    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, societyId: session.societyId, ownerUserId: session.id, status: 'PENDING', expiresAt: { gt: new Date() } },
      data: { transactionId: data.transactionId, screenshotUrl: uploadedScreenshot, notes: data.notes || null },
    });
    if (claimed.count !== 1) {
      await removeStoredFile(uploadedScreenshot);
      uploadedScreenshot = null;
      return NextResponse.json({ error: 'This payment was already submitted or has expired.' }, { status: 409 });
    }
    const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
    if (!updated) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    if (payment.screenshotUrl && payment.screenshotUrl !== uploadedScreenshot) await removeStoredFile(payment.screenshotUrl);
    return NextResponse.json({ payment: { ...updated, amountPaise: updated.amountPaise.toString() } });
  } catch (e) {
    await removeStoredFile(uploadedScreenshot);
    const message = e instanceof Error ? e.message : '';
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code) : '';
    const status = e instanceof z.ZodError ? 400 : message === 'UNAUTHORIZED' ? 401 : message === 'SCREENSHOT_TOO_LARGE' || message === 'INVALID_SCREENSHOT' ? 400 : code === 'P2002' ? 409 : 500;
    return NextResponse.json({ error: status === 400 ? 'Invalid payment screenshot/details.' : status === 401 ? 'Unauthorized' : status === 409 ? 'This transaction reference has already been submitted.' : 'Server error' }, { status });
  }
}
