import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';


async function supabaseRest<T>(table: string, params: Record<string,string>): Promise<T> {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('SUPABASE server configuration is missing');
  const url = new URL(base + '/rest/v1/' + table);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url.toString(), { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' }, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error('Supabase ' + table + ' request failed');
  return data as T;
}

export const SUBADMIN_PERMISSIONS = ['EVENTS', 'NOTICES', 'GALLERY', 'BILLS', 'EXPENSES', 'INCOME', 'PAYMENTS', 'REPORTS'] as const;
export type SubAdminPermission = typeof SUBADMIN_PERMISSIONS[number];
export type SessionUser = { id: string; role: 'MASTER_ADMIN' | 'ORGANIZER' | 'OWNER'; societyId: string; email: string; name: string; permissions: string[] };
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
    const rows = await supabaseRest<Array<{id:string;role:SessionUser['role'];societyId:string;email:string;name:string;status:string;approvalStatus:string;emailVerified:boolean;permissions:string[]}>>('User', { id: 'eq.' + String(payload.id), select: 'id,role,societyId,email,name,status,approvalStatus,emailVerified,permissions', limit: '1' });
    const user = rows[0] || null;

    if (!user || user.societyId !== String(payload.societyId) || user.status !== 'ACTIVE') return null;
    if (user.role !== role) return null;

    // Resident sessions are valid only for active, email-verified accounts. New residents are auto-admitted after Firebase verification; legacy pending/rejected records remain blocked.
    if (user.role === 'OWNER' && (user.approvalStatus !== 'APPROVED' || !user.emailVerified)) return null;

    return {
      id: user.id,
      role: user.role,
      societyId: user.societyId,
      email: user.email,
      name: user.name,
      permissions: user.permissions,
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

export async function requireSubAdminPermission(permission: SubAdminPermission) {
  const session = await requireAdmin();
  if (session.role === 'MASTER_ADMIN' || session.permissions.includes(permission)) return session;
  throw new Error('FORBIDDEN_PERMISSION');
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


