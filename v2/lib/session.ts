import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

export type SessionUser = { id: string; role: 'MASTER_ADMIN' | 'ORGANIZER' | 'OWNER'; societyId: string; email: string; name: string; permissions: string[] };

const FETCH_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function supabaseRest<T>(table: string, params: Record<string,string>): Promise<T> {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('SUPABASE server configuration is missing');
  const url = new URL(base + '/rest/v1/' + table);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetchWithTimeout(url.toString(), { headers: { apikey:key, Authorization:'Bearer '+key, Accept:'application/json' }, cache:'no-store' });
  const data = await response.json().catch(()=>null);
  if (!response.ok) throw new Error('Supabase ' + table + ' request failed');
  return data as T;
}

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET is required');
const key = new TextEncoder().encode(secret);

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get('society_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    if (!payload.id || !payload.role || !payload.societyId) return null;
    const role = payload.role as SessionUser['role'];
    if (!['MASTER_ADMIN','ORGANIZER','OWNER'].includes(role)) return null;
    const rows = await supabaseRest<Array<{id:string;role:SessionUser['role'];societyId:string;email:string;name:string;status:string;approvalStatus:string;emailVerified:boolean;permissions:string[]}>>('User', { id:'eq.'+String(payload.id), select:'id,role,societyId,email,name,status,approvalStatus,emailVerified,permissions', limit:'1' });
    const user=rows[0];
    if (!user || user.societyId !== String(payload.societyId) || user.status !== 'ACTIVE' || user.role !== role) return null;
    if (user.role === 'OWNER' && (user.approvalStatus !== 'APPROVED' || !user.emailVerified)) return null;
    return { id:user.id, role:user.role, societyId:user.societyId, email:user.email, name:user.name, permissions:user.permissions || [] };
  } catch { return null; }
}
export async function requireSession(){ const session=await getSession(); if(!session) throw new Error('UNAUTHORIZED'); return session; }

export async function requireSubAdminPermission(permission:string){const s=await requireSession();if(s.role==='MASTER_ADMIN'||(s.role==='ORGANIZER'&&s.permissions.includes(permission)))return s;throw new Error('FORBIDDEN');}
export async function requireAdmin(){const s=await requireSession();if(s.role==='MASTER_ADMIN'||s.role==='ORGANIZER')return s;throw new Error('FORBIDDEN');}
