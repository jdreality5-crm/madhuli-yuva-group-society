import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import { firebaseAuthConfigured, firebaseLookup, firebaseSignIn, normalizeGmail } from '@/lib/firebase-auth';


const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_MINUTES = 15;

async function supabaseRest<T>(table: string, params: Record<string,string>, init?: RequestInit): Promise<T> {
  const base=process.env.SUPABASE_URL?.trim().replace(/\/$/,''); const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!base||!key) throw new Error('SUPABASE server configuration is missing');
  const url=new URL(base+'/rest/v1/'+table); Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const res=await fetch(url.toString(),{...init,headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json',...(init?.body?{'Content-Type':'application/json',Prefer:'return=representation'}:{}),...(init?.headers||{})},cache:'no-store'});
  const data=await res.json().catch(()=>null); if(!res.ok) throw new Error('Supabase '+table+' request failed'); return data as T;
}
type LoginUser={id:string;email:string;name:string;role:'MASTER_ADMIN'|'ORGANIZER'|'OWNER';societyId:string;status:string;approvalStatus:string;emailVerified:boolean;firebaseUid?:string|null;unitId?:string|null;residentType?:string|null;mobile?:string|null;permissions:string[];passwordHash?:string|null;loginLockedUntil?:string|Date|null;failedLoginAttempts:number;emailLockedUntil?:string|Date|null;mobileLockedUntil?:string|Date|null};
async function getUserByEmail(email:string){const rows=await supabaseRest<LoginUser[]>('User',{select:'id,email,name,role,societyId,status,approvalStatus,emailVerified,firebaseUid,unitId,residentType,mobile,permissions,passwordHash,loginLockedUntil,failedLoginAttempts,emailLockedUntil,mobileLockedUntil',email:'eq.'+email,limit:'1'});return rows[0]||null;}
async function recordLoginFailure(user:LoginUser){const attempts=(user.failedLoginAttempts||0)+1;const data:any={failedLoginAttempts:attempts,updatedAt:new Date().toISOString()};if(attempts>=LOGIN_MAX_FAILURES)data.loginLockedUntil=new Date(Date.now()+LOGIN_LOCK_MINUTES*60*1000).toISOString();await supabaseRest('User',{id:'eq.'+user.id,status:'eq.ACTIVE'},{method:'PATCH',body:JSON.stringify(data)});}
async function clearLoginFailures(userId:string){await supabaseRest('User',{id:'eq.'+userId},{method:'PATCH',body:JSON.stringify({failedLoginAttempts:0,loginLockedUntil:null,updatedAt:new Date().toISOString()})});}
async function createEdgeSession(user:LoginUser){const secret=process.env.JWT_SECRET?.trim();if(!secret)throw new Error('JWT_SECRET is required');const token=await new SignJWT({id:user.id,role:user.role,societyId:user.societyId,email:user.email,name:user.name,permissions:user.permissions||[]}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('7d').sign(new TextEncoder().encode(secret));(await cookies()).set('society_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:604800});}

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
    const user = await getUserByEmail(email);
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
        if (user.unitId && !user.emailVerified) {
          const lockUntil = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
          const linked = await supabaseRest<Array<{id:string}>>('PropertyUnit',{id:'eq.'+user.unitId,residentUserId:'is.null',status:'eq.ACTIVE',select:'id',limit:'1'},{method:'PATCH',body:JSON.stringify({residentUserId:user.id,residentType:user.residentType||'OWNER',ownerName:user.name,ownerMobile:user.mobile,ownerEmail:user.email})});
        const activation={claimed:linked.length===1};
          if (!activation.claimed) {
            return NextResponse.json({ error: 'This residence has already been registered by another resident. Please contact the society administrator.' }, { status: 409 });
          }
        } else if (!user.emailVerified || user.status !== 'ACTIVE') {
          const lockUntil = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
          await supabaseRest('User',{id:'eq.'+user.id},{method:'PATCH',body:JSON.stringify({emailVerified:true,status:'ACTIVE',approvalStatus:'APPROVED',emailLockedUntil:user.emailLockedUntil||lockUntil,mobileLockedUntil:user.mobileLockedUntil||lockUntil,updatedAt:new Date().toISOString()})});
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
    await createEdgeSession(user);
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, societyId: user.societyId } });
  } catch (error) {
    console.error('[auth/login] server error', error);
    return NextResponse.json({ error: 'Login service temporarily unavailable' }, { status: 500 });
  }
}
