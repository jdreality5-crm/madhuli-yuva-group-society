import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession, prisma } from '@/lib/auth';

const schema = z.object({ email: z.string().trim().email().max(254), otp: z.string().regex(/^\d{6}$/) });
const MAX_ATTEMPTS = 5;
const hashOtp = async (otp: string) => { const bytes = new TextEncoder().encode(otp); const digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join(''); };

export async function POST(req: Request) {
  try {
    let body: z.infer<typeof schema>;
    try { body = schema.parse(await req.json()); } catch { return NextResponse.json({ error: 'Enter the 6-digit verification code.' }, { status: 400 }); }
    const email = body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'OWNER' || user.emailVerified) return NextResponse.json({ error: 'No pending email verification was found.' }, { status: 403 });
    if (user.status !== 'INACTIVE' || user.approvalStatus === 'REJECTED') return NextResponse.json({ error: 'This verification request is no longer active.' }, { status: 400 });
    const token = await prisma.verificationToken.findFirst({ where: { userId: user.id, consumedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!token || token.expiresAt.getTime() <= Date.now()) return NextResponse.json({ error: 'This verification code has expired. Please request a new code.' }, { status: 400 });
    if (token.attempts >= MAX_ATTEMPTS) return NextResponse.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 });
    if (await hashOtp(body.otp) !== token.tokenHash) {
      const result = await prisma.verificationToken.updateMany({ where: { id: token.id, consumedAt: null, attempts: { lt: MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
      if (result.count === 0) return NextResponse.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 });
      return NextResponse.json({ error: 'Incorrect verification code.' }, { status: 400 });
    }
    const now = new Date();
    const result = await prisma.$transaction(async tx => {
      const claimed = await tx.verificationToken.updateMany({ where: { id: token.id, userId: user.id, consumedAt: null, expiresAt: { gt: now }, attempts: { lt: MAX_ATTEMPTS }, tokenHash: token.tokenHash }, data: { consumedAt: now } });
      if (claimed.count !== 1) return null;
      const updated = await tx.user.update({ where: { id: user.id }, data: { emailVerified: true, status: user.approvalStatus === 'APPROVED' ? 'ACTIVE' : 'INACTIVE' } });
      return { approved: updated.approvalStatus === 'APPROVED' };
    });
    if (!result) return NextResponse.json({ error: 'This verification code is no longer valid. Please request a new code.' }, { status: 409 });
    if (!result.approved) return NextResponse.json({ verified: true, approvalPending: true, message: 'Email verified. Your registration is awaiting Master Admin approval.' });
    await createSession({ id: user.id, role: user.role, societyId: user.societyId, email: user.email, name: user.name });
    return NextResponse.json({ verified: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, societyId: user.societyId, flatId: user.flatId } });
  } catch (error) { console.error('[auth/verify-email] server error', error); return NextResponse.json({ error: 'Email verification temporarily unavailable' }, { status: 500 }); }
}
