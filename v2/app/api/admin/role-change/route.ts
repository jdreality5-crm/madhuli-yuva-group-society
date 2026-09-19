import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { sendVerificationOtp } from '@/lib/verification-email';

async function rest<T>(table:string,q:Record<string,string>={},init?:RequestInit){const b=process.env.SUPABASE_URL?.trim().replace(/\/$/,'');const k=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!b||!k)throw Error('CONFIG');const u=new URL(b+'/rest/v1/'+table);Object.entries(q).forEach(([a,v])=>u.searchParams.set(a,v));const res=await fetch(u,{...init,headers:{apikey:k,Authorization:'Bearer '+k,Accept:'application/json',...(init?.body?{'Content-Type':'application/json','Prefer':'return=representation'}:{}),...(init?.headers||{})},cache:'no-store'});const d=await res.json().catch(()=>null);if(!res.ok)throw Error('REST');return d as T}

const schema=z.object({targetUserId:z.string().min(1),toRole:z.enum(['MASTER_ADMIN','ORGANIZER']),password:z.string().min(1)});

export async function GET(){try{const s=await requireSession();if(s.role!=='MASTER_ADMIN')return NextResponse.json({error:'Master Admin access required'},{status:403});const users=await rest<any[]>('User',{select:'id,name,email,role,status,permissions',societyId:'eq.'+s.societyId,role:'in.(MASTER_ADMIN,ORGANIZER)',status:'eq.ACTIVE',order:'name.asc'});return NextResponse.json({users:users.filter(u=>u.id!==s.id)})}catch(e){return NextResponse.json({error:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Server error'},{status:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500})}}

export async function POST(req:Request){try{
 const s=await requireSession();if(s.role!=='MASTER_ADMIN')return NextResponse.json({error:'Master Admin access required'},{status:403});
 const d=schema.parse(await req.json());if(d.targetUserId===s.id)return NextResponse.json({error:'You cannot change your own role through this workflow.'},{status:400});
 const targets=await rest<any[]>('User',{select:'id,name,email,role,status,passwordHash',id:'eq.'+d.targetUserId,societyId:'eq.'+s.societyId,role:'in.(MASTER_ADMIN,ORGANIZER)',status:'eq.ACTIVE',limit:'1'});
 const target=targets[0];if(!target)return NextResponse.json({error:'Target admin account not found.'},{status:404});
 if(target.role===d.toRole)return NextResponse.json({error:'Target already has this role.'},{status:409});
 if(!(await bcrypt.compare(d.password,(await rest<any[]>('User',{select:'passwordHash',id:'eq.'+s.id,societyId:'eq.'+s.societyId,role:'eq.MASTER_ADMIN',status:'eq.ACTIVE',limit:'1'}))[0]?.passwordHash||'')))return NextResponse.json({error:'Current Master Admin password is incorrect.'},{status:401});
 const pending=await rest<any[]>('RoleChangeRequest',{select:'id',requesterId:'eq.'+s.id,status:'eq.PENDING',expiresAt:'gt.'+new Date().toISOString(),limit:'1'});if(pending.length)return NextResponse.json({error:'A role-change verification is already pending.'},{status:409});
 const otp=String(crypto.randomInt(100000,1000000));const hash=crypto.createHash('sha256').update(otp).digest('hex');const id=crypto.randomUUID();const expires=new Date(Date.now()+10*60*1000).toISOString();
 await rest('RoleChangeRequest',{}, {method:'POST',body:JSON.stringify({id,societyId:s.societyId,requesterId:s.id,targetUserId:target.id,fromRole:target.role,toRole:d.toRole,status:'PENDING',verificationHash:hash,expiresAt:expires})});
 try{await sendVerificationOtp(s.email,otp)}catch{await rest('RoleChangeRequest',{id:'eq.'+id},{method:'DELETE'});return NextResponse.json({error:'Verification email could not be sent. No role change was made.'},{status:503})}
 return NextResponse.json({requestId:id,expiresAt:expires,message:'Verification code sent to the current Master Admin email.'});
}catch(e){return NextResponse.json({error:e instanceof z.ZodError?'Invalid role-change request.':'Server error'},{status:e instanceof z.ZodError?400:500})}}
