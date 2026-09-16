import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession, prisma } from '@/lib/auth';

const schema = z.object({ email: z.string().trim().email(), otp: z.string().regex(/^\d{6}$/) });
const MAX_ATTEMPTS = 5;
const hashOtp = async (otp: string) => {
  const bytes = new TextEncoder().encode(otp);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('');
};

export async function POST(req: Request) {
  try {
    let body: z.infer<typeof schema>;
    try { body = schema.parse(await req.json()); } catch { return NextResponse.json({ error: 'Enter the 6-digit verification code.' }, { status: 400 }); }
    const email = body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'OWNER' || user.status !== 'INACTIVE') return NextResponse.json({ error: 'Invalid or expired verification request.' }, { status: 400 });

    const token = await prisma.verificationToken.findFirst({ where: { userId: user.id, consumedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!token || token.expiresAt.getTime() <= Date.now()) return NextResponse.json({ error: 'This verification code has expired. Please request a new code.' }, { status: 400 });
    if (token.attempts >= MAX_ATTEMPTS) return NextResponse.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 });

    if (await hashOtp(body.otp) !== token.tokenHash) {
      await prisma.verificationToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
      return NextResponse.json({ error: 'Incorrect verification code.' }, { status: 400 });
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.verificationToken.update({ where: { id: token.id }, data: { consumedAt: now } }),
      prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } }),
    ]);
    await createSession({ id: user.id, role: user.role, societyId: user.societyId, email: user.email, name: user.name });
    return NextResponse.json({ verified: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, societyId: user.societyId, flatId: user.flatId } });
  } catch (error) { console.error('[auth/verify-email] server error', error); return NextResponse.json({ error: 'Email verification temporarily unavailable' }, { status: 500 }); }
}
