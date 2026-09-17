import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/auth';
import { emailVerificationConfigured, sendVerificationOtp } from '@/lib/verification-email';

const schema = z.object({ email: z.string().trim().email().max(254) });
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const hashOtp = async (otp: string) => {
  const bytes = new TextEncoder().encode(otp);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('');
};

// Rejection sampling avoids modulo bias while keeping the OTP generation
// cryptographically random and compatible with Cloudflare Workers.
const newOtp = () => {
  const limit = Math.floor(0x100000000 / 900000) * 900000;
  const bytes = new Uint32Array(1);
  do crypto.getRandomValues(bytes); while (bytes[0] >= limit);
  return String(100000 + (bytes[0] % 900000));
};

export async function POST(req: Request) {
  try {
    let body: z.infer<typeof schema>;
    try { body = schema.parse(await req.json()); } catch { return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 }); }
    if (!emailVerificationConfigured()) return NextResponse.json({ error: 'Email verification is not configured yet.' }, { status: 503 });

    const email = body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'OWNER') return NextResponse.json({ error: 'No owner verification request was found for this email.' }, { status: 404 });
    if (user.approvalStatus !== 'APPROVED') return NextResponse.json({ error: 'Master Admin approval is required before sending an OTP.' }, { status: 403 });
    if (user.emailVerified) return NextResponse.json({ error: 'This email is already verified. Please login.' }, { status: 409 });
    if (user.status !== 'INACTIVE') return NextResponse.json({ error: 'No pending owner verification was found for this email.' }, { status: 404 });

    const latest = await prisma.verificationToken.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      return NextResponse.json({ error: 'Please wait 60 seconds before requesting another code.' }, { status: 429 });
    }

    // Invalidate any previous pending code before creating the replacement.
    await prisma.verificationToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const otp = newOtp();
    const tokenHash = await hashOtp(otp);
    const token = await prisma.verificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });

    try {
      await sendVerificationOtp(email, otp);
    } catch (error) {
      // Never leave a token usable when the provider did not confirm delivery.
      await prisma.verificationToken.updateMany({
        where: { id: token.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      throw error;
    }

    return NextResponse.json({ sent: true, email, message: 'A new verification code has been sent.' });
  } catch (error) {
    console.error('[auth/resend-verification] server error', error);
    return NextResponse.json({ error: 'Unable to resend verification code' }, { status: 500 });
  }
}
