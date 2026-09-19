import { NextResponse } from 'next/server';
import { firebaseApplyVerificationCode, firebaseAuthConfigured, normalizeGmail } from '@/lib/firebase-auth';

async function rest<T>(table:string,q:Record<string,string>):Promise<T>{
  const base=process.env.SUPABASE_URL?.trim().replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!base||!key) throw new Error('Supabase configuration is missing');
  const url=new URL(base+'/rest/v1/'+table);
  Object.entries(q).forEach(([k,v])=>url.searchParams.set(k,v));
  const r=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json'},cache:'no-store'});
  const d=await r.json().catch(()=>null);
  if(!r.ok) throw new Error('Supabase request failed');
  return d as T;
}
async function rpc<T>(name:string,body:Record<string,unknown>):Promise<T>{
  const base=process.env.SUPABASE_URL?.trim().replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!base||!key) throw new Error('Supabase configuration is missing');
  const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const d=await r.json().catch(()=>null);
  if(!r.ok) throw new Error('Supabase RPC request failed');
  return d as T;
}

export async function GET(req:Request){
  try{
    if(!firebaseAuthConfigured()) return NextResponse.json({error:'Firebase Authentication is not configured.'},{status:503});
    const oobCode=new URL(req.url).searchParams.get('oobCode')?.trim();
    if(!oobCode) return NextResponse.json({error:'Verification link is missing or invalid.'},{status:400});
    const result=await firebaseApplyVerificationCode(oobCode);
    const email=normalizeGmail(result.email);
    const users=await rest<Array<{id:string;role:string;approvalStatus:string;firebaseUid:string|null;unitId:string|null;status:string;emailVerified:boolean}>>('User',{
      select:'id,role,approvalStatus,firebaseUid,unitId,status,emailVerified',
      email:'eq.'+email,
      limit:'1'
    });
    const user=users[0];
    if(!user||user.role!=='OWNER'||user.approvalStatus!=='APPROVED'||!user.firebaseUid||user.firebaseUid!==result.localId){
      return NextResponse.json({error:'No matching resident registration was found.'},{status:404});
    }
    if(!user.unitId||user.status!=='INACTIVE'||user.emailVerified){
      return NextResponse.json({error:'This resident verification is no longer valid. Please sign in again.'},{status:409});
    }
    const lockUntil=new Date(Date.now()+15*24*60*60*1000).toISOString();
    const activated=await rpc<boolean>('activate_resident_atomic',{p_user_id:user.id,p_unit_id:user.unitId,p_lock_until:lockUntil});
    if(!activated) return NextResponse.json({error:'This residence has already been registered by another resident. Please contact the society administrator.'},{status:409});
    return NextResponse.json({verified:true,email,message:'Gmail verified and your resident account is now active. Please sign in with your password.'});
  }catch(error){
    const message=error instanceof Error?error.message:'';
    if(message.includes('EXPIRED_OOB_CODE')||message.includes('INVALID_OOB_CODE')) return NextResponse.json({error:'This verification link has expired or has already been used. Please request a new verification email.'},{status:400});
    console.error('[auth/verify-email] server error',error);
    return NextResponse.json({error:'Email verification temporarily unavailable'},{status:500});
  }
}
export async function POST(){return NextResponse.json({error:'Use the Firebase verification link sent to your Gmail address.'},{status:410});}
