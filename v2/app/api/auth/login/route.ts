import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createSession, prisma } from '@/lib/auth';
import { firebaseAuthConfigured, firebaseLookup, firebaseSignIn, normalizeGmail } from '@/lib/firebase-auth';


const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_MINUTES = 15;

async function recordLoginFailure(userId: string) {
  const now = new Date();
  await prisma.user.updateMany({
    where: { id: userId, status: 'ACTIVE', OR: [{ loginLockedUntil: null }, { loginLockedUntil: { lte: now } }] },
    data: { failedLoginAttempts: { increment: 1 } },
  });
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { failedLoginAttempts: true, loginLockedUntil: true } });
  if (current && current.failedLoginAttempts >= LOGIN_MAX_FAILURES && (!current.loginLockedUntil || current.loginLockedUntil <= now)) {
    const lockedUntil = new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60 * 1000);
    await prisma.user.updateMany({
      where: { id: userId, failedLoginAttempts: { gte: LOGIN_MAX_FAILURES }, OR: [{ loginLockedUntil: null }, { loginLockedUntil: { lte: now } }] },
      data: { loginLockedUntil: lockedUntil },
    });
  }
}

async function clearLoginFailures(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: 0, loginLockedUntil: null } });
}

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  role: z.enum(['MASTER_ADMIN', 'ORGANIZER', 'OWNER']).optional(),
});

export async function POST(req: Request) {
  try {
    let body: z.infer<typeof schema>;
    try { body = schema.parse(await req.json()); }
    catch { return NextResponse.json({ error: 'Invalid email, password, or role.' }, { status: 400 }); }

    const email = normalizeGmail(body.email);
    const user = await prisma.user.findUnique({ where: { email } });
    const isFirebaseResident = user?.role === 'OWNER' && Boolean(user.firebaseUid);
    if (!user || (user.status !== 'ACTIVE' && !isFirebaseResident) || (body.role && user.role !== body.role)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    if (user.loginLockedUntil && user.loginLockedUntil > new Date()) {
      return NextResponse.json({ error: 'Too many failed login attempts. Please try again after 15 minutes.' }, { status: 429 });
    }

    if (user.role === 'OWNER' && user.firebaseUid) {
      if (!firebaseAuthConfigured()) return NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 });
      try {
        const authResult = await firebaseSignIn(email, body.password);
        const firebaseUser = await firebaseLookup(authResult.idToken);
        if (!firebaseUser || firebaseUser.localId !== user.firebaseUid || firebaseUser.emailVerified !== true || firebaseUser.disabled === true) {
          return NextResponse.json({ error: 'Please verify your Gmail address before signing in.' }, { status: 403 });
        }
        if (!user.emailVerified || user.status !== 'ACTIVE') {
          const lockUntil = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
          await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, status: 'ACTIVE', approvalStatus: 'APPROVED', emailLockedUntil: user.emailLockedUntil || lockUntil, mobileLockedUntil: user.mobileLockedUntil || lockUntil } });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message.includes('EMAIL_NOT_FOUND') || message.includes('INVALID_PASSWORD') || message.includes('INVALID_LOGIN_CREDENTIALS')) {
          await recordLoginFailure(user.id);
          return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }
        if (message.includes('USER_DISABLED')) return NextResponse.json({ error: 'This account is disabled. Please contact the society administrator.' }, { status: 403 });
        console.error('[auth/login] Firebase resident authentication error', error);
        return NextResponse.json({ error: 'Authentication service temporarily unavailable' }, { status: 503 });
      }
    } else {
      if (!user.passwordHash || !(await bcrypt.compare(body.password, user.passwordHash))) {
        await recordLoginFailure(user.id);
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      if (user.role === 'OWNER') {
        if (!user.emailVerified) return NextResponse.json({ error: 'Please verify your email before signing in.' }, { status: 403 });
        if (user.approvalStatus !== 'APPROVED') return NextResponse.json({ error: 'Your resident registration is not active yet.' }, { status: 403 });
      }
    }

    await clearLoginFailures(user.id);
    await createSession({ id: user.id, role: user.role, societyId: user.societyId, email: user.email, name: user.name, permissions: user.permissions });
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, societyId: user.societyId } });
  } catch (error) {
    console.error('[auth/login] server error', error);
    return NextResponse.json({ error: 'Login service temporarily unavailable' }, { status: 500 });
  }
}
