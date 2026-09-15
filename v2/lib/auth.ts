import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';

export type SessionUser = { id: string; role: 'ORGANIZER' | 'OWNER'; societyId: string; email: string; name: string };
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
    if (!payload.id || !payload.role || !payload.societyId || !payload.email || !payload.name) return null;
    return { id: String(payload.id), role: payload.role as SessionUser['role'], societyId: String(payload.societyId), email: String(payload.email), name: String(payload.name) };
  } catch { return null; }
}

export async function requireOrganizer() {
  const session = await getSession();
  if (!session || session.role !== 'ORGANIZER') throw new Error('FORBIDDEN');
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}

export { prisma };
