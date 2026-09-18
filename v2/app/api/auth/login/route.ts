import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createSession, prisma } from '@/lib/auth';
import { firebaseAuthConfigured, firebaseLookup, firebaseSignIn, normalizeGmail } from '@/lib/firebase-auth';

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
    if (!user || user.status !== 'ACTIVE' || (body.role && user.role !== body.role)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
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
          return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }
        if (message.includes('USER_DISABLED')) return NextResponse.json({ error: 'This account is disabled. Please contact the society administrator.' }, { status: 403 });
        console.error('[auth/login] Firebase resident authentication error', error);
        return NextResponse.json({ error: 'Authentication service temporarily unavailable' }, { status: 503 });
      }
    } else {
      if (!user.passwordHash || !(await bcrypt.compare(body.password, user.passwordHash))) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      if (user.role === 'OWNER') {
        if (!user.emailVerified) return NextResponse.json({ error: 'Please verify your email before signing in.' }, { status: 403 });
        if (user.approvalStatus !== 'APPROVED') return NextResponse.json({ error: 'Your resident registration is not active yet.' }, { status: 403 });
      }
    }

    await createSession({ id: user.id, role: user.role, societyId: user.societyId, email: user.email, name: user.name });
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, societyId: user.societyId } });
  } catch (error) {
    console.error('[auth/login] server error', error);
    return NextResponse.json({ error: 'Login service temporarily unavailable' }, { status: 500 });
  }
}
