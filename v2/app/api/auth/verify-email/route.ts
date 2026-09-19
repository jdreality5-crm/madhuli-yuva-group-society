import { NextResponse } from 'next/server';
import { firebaseApplyVerificationCode, firebaseAuthConfigured, normalizeGmail } from '@/lib/firebase-auth';
import { prisma } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    if (!firebaseAuthConfigured()) return NextResponse.json({ error: 'Firebase Authentication is not configured.' }, { status: 503 });
    const oobCode = new URL(req.url).searchParams.get('oobCode')?.trim();
    if (!oobCode) return NextResponse.json({ error: 'Verification link is missing or invalid.' }, { status: 400 });

    const result = await firebaseApplyVerificationCode(oobCode);
    if (result.requestType !== 'VERIFY_EMAIL' || result.emailVerified !== true) {
      return NextResponse.json({ error: 'This link is not a valid Gmail verification link.' }, { status: 400 });
    }
    const email = normalizeGmail(result.email);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, approvalStatus: true, firebaseUid: true } });
    if (!user || user.role !== 'OWNER' || user.approvalStatus !== 'APPROVED' || !user.firebaseUid || user.firebaseUid !== result.localId) {
      return NextResponse.json({ error: 'No matching resident registration was found.' }, { status: 404 });
    }

    // Email verification itself completes resident activation. The application
    // session is still created only after a normal password login.
    const lockUntil = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
        emailLockedUntil: { set: lockUntil },
        mobileLockedUntil: { set: lockUntil },
      },
    });

    return NextResponse.json({ verified: true, email, message: 'Gmail verified and your resident account is now active. Please sign in with your password.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('EXPIRED_OOB_CODE') || message.includes('INVALID_OOB_CODE')) {
      return NextResponse.json({ error: 'This verification link has expired or has already been used. Please request a new verification email.' }, { status: 400 });
    }
    console.error('[auth/verify-email] server error', error);
    return NextResponse.json({ error: 'Email verification temporarily unavailable' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Use the Firebase verification link sent to your Gmail address.' }, { status: 410 });
}
