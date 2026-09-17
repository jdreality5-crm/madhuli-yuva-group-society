import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';

export type SessionUser = { id: string; role: 'MASTER_ADMIN' | 'ORGANIZER' | 'OWNER'; societyId: string; email: string; name: string };
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET is required');
const key = new TextEncoder().encode(secret);

export async function createSession(user: SessionUser) {
  const token = await new SignJWT(user).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(key);
  const jar = await cookies();
  jar.set('society_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get('society_session')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, key);
    if (!payload.id || !payload.role || !payload.societyId) return null;

    const role = payload.role as SessionUser['role'];
    if (!['MASTER_ADMIN', 'ORGANIZER', 'OWNER'].includes(role)) return null;

    // JWT proves the session was signed by us; the database remains authoritative
    // for current role, society, activation, approval, and email-verification state.
    const user = await prisma.user.findUnique({
      where: { id: String(payload.id) },
      select: {
        id: true,
        role: true,
        societyId: true,
        email: true,
        name: true,
        status: true,
        approvalStatus: true,
        emailVerified: true,
      },
    });

    if (!user || user.societyId !== String(payload.societyId) || user.status !== 'ACTIVE') return null;
    if (user.role !== role) return null;

    // Resident sessions are invalid unless the account is fully admitted.
    if (user.role === 'OWNER' && (user.approvalStatus !== 'APPROVED' || !user.emailVerified)) return null;

    return {
      id: user.id,
      role: user.role,
      societyId: user.societyId,
      email: user.email,
      name: user.name,
    };
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session || !['MASTER_ADMIN', 'ORGANIZER'].includes(session.role)) throw new Error('FORBIDDEN');
  return session;
}

export async function requireOrganizer() {
  const session = await getSession();
  if (!session || !['MASTER_ADMIN', 'ORGANIZER'].includes(session.role)) throw new Error('FORBIDDEN');
  return session;
}

export async function requireMasterAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'MASTER_ADMIN') throw new Error('FORBIDDEN');
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}

export { prisma };
