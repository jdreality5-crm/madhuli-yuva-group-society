import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createHash, randomInt } from 'node:crypto';
import { z } from 'zod';
import { createSession, prisma } from '@/lib/auth';
import { emailVerificationConfigured, sendVerificationOtp } from '@/lib/verification-email';

const SOCIETY_ID = 'demo-society-v2';
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const schema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email(), mobile: z.string().trim().min(10).max(15), flatNumber: z.string().trim().min(1).max(30), password: z.string().min(8).max(128) });
const normalizeMobile = (value: string) => value.replace(/[^0-9+]/g, '');
const hashOtp = (otp: string) => createHash('sha256').update(otp).digest('hex');
const newOtp = () => randomInt(100000, 1000000).toString();

async function issueOtp(userId: string, email: string) {
  const latest = await prisma.verificationToken.findFirst({ where: { userId, consumedAt: null }, orderBy: { createdAt: 'desc' } });
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new Error('OTP_COOLDOWN');
  }
  await prisma.verificationToken.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: new Date() } });
  const otp = newOtp();
  await prisma.verificationToken.create({ data: { userId, tokenHash: hashOtp(otp), expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
  await sendVerificationOtp(email, otp);
}

export async function POST(req: Request) {
  try {
    let body: z.infer<typeof schema>;
    try { body = schema.parse(await req.json()); } catch { return NextResponse.json({ error: 'Please enter valid signup details. Password must be at least 8 characters.' }, { status: 400 }); }
    if (!emailVerificationConfigured()) return NextResponse.json({ error: 'Email verification is not configured yet. Please contact the society administrator.' }, { status: 503 });
    const email = body.email.toLowerCase();
    const mobile = normalizeMobile(body.mobile);
    const society = await prisma.society.findUnique({ where: { id: SOCIETY_ID } });
    if (!society) return NextResponse.json({ error: 'Society registration is not ready yet. Please ask the society administrator.' }, { status: 503 });
    const flat = await prisma.flat.findFirst({ where: { societyId: society.id, flatNumber: body.flatNumber, status: 'ACTIVE' } });
    if (!flat) return NextResponse.json({ error: 'This flat is not registered or is inactive. Please contact the society administrator.' }, { status: 404 });
    if (!flat.signupEnabled) return NextResponse.json({ error: 'Owner signup is not enabled for this flat. Please contact the society administrator.' }, { status: 403 });
    const registeredEmail = flat.email?.trim().toLowerCase();
    const registeredMobile = flat.mobile ? normalizeMobile(flat.mobile) : null;
    if (!registeredEmail && !registeredMobile) return NextResponse.json({ error: 'This flat is not pre-registered for online signup.' }, { status: 403 });
    if (registeredEmail && registeredEmail !== email) return NextResponse.json({ error: 'The email does not match the society record for this flat.' }, { status: 403 });
    if (registeredMobile && registeredMobile !== mobile) return NextResponse.json({ error: 'The mobile number does not match the society record for this flat.' }, { status: 403 });
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) return NextResponse.json({ error: existingEmail.status === 'INACTIVE' && existingEmail.role === 'OWNER' ? 'This signup is already awaiting email verification. Please use the verification code.' : 'An account with this email already exists. Please login instead.' }, { status: 409 });
    const existingFlatOwner = await prisma.user.findFirst({ where: { societyId: society.id, flatId: flat.id, role: 'OWNER' }, select: { id: true } });
    if (existingFlatOwner) return NextResponse.json({ error: 'This flat already has a registered owner account. Please login or contact the administrator.' }, { status: 409 });

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({ data: { name: body.name, email, mobile, passwordHash, role: 'OWNER', status: 'INACTIVE', societyId: society.id, flatId: flat.id } });
    try {
      await issueOtp(user.id, email);
    } catch (error) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      if (error instanceof Error && error.message === 'OTP_COOLDOWN') return NextResponse.json({ error: 'Please wait before requesting another verification code.' }, { status: 429 });
      throw error;
    }
    if (!flat.ownerName || !flat.mobile) await prisma.flat.update({ where: { id: flat.id }, data: { ownerName: flat.ownerName || body.name, mobile: flat.mobile || mobile } });
    return NextResponse.json({ verificationRequired: true, email, message: 'Verification code sent to your registered email.' }, { status: 201 });
  } catch (error) { console.error('[auth/signup] server error', error); return NextResponse.json({ error: 'Signup service temporarily unavailable' }, { status: 500 }); }
}
