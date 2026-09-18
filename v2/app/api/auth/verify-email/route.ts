import { NextResponse } from 'next/server';
import { createSession, prisma } from '@/lib/auth';
import { firebaseApplyVerificationCode, firebaseAuthConfigured, normalizeGmail } from '@/lib/firebase-auth';

const CONTACT_LOCK_DAYS = 15;

export async function GET(req: Request) {
  try {
    if (!firebaseAuthConfigured()) return NextResponse.json({ error: 'Firebase Authentication is not configured.' }, { status: 503 });
    const url = new URL(req.url);
    const oobCode = url.searchParams.get('oobCode')?.trim();
    if (!oobCode) return NextResponse.json({ error: 'Verification link is missing or invalid.' }, { status: 400 });

    const result = await firebaseApplyVerificationCode(oobCode);
    const email = normalizeGmail(result.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'OWNER' || user.approvalStatus !== 'APPROVED') {
      return NextResponse.json({ error: 'No matching resident registration was found.' }, { status: 404 });
    }

    const lockedUntil = new Date(Date.now() + CONTACT_LOCK_DAYS * 24 * 60 * 60 * 1000);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, status: 'ACTIVE', emailLockedUntil: lockedUntil, mobileLockedUntil: lockedUntil },
    });

    await createSession({ id: updated.id, role: updated.role, societyId: updated.societyId, email: updated.email, name: updated.name });
    return NextResponse.json({
      verified: true,
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, societyId: updated.societyId, flatId: updated.flatId },
    });
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
  return NextResponse.json({ error: 'This verification flow uses the Firebase email verification link. Please open the verification email sent to your Gmail address.' }, { status: 410 });
}
