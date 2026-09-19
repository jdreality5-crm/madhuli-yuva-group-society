import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireSession } from '@/lib/session';

const schema=z.object({currentPassword:z.string().min(1),newPassword:z.string().min(8).max(128)});

async function rest<T>(table:string,q:Record<string,string>,init:RequestInit={}):Promise<T>{
  const base=process.env.SUPABASE_URL?.trim().replace(/\/$/,'');const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!base||!key)throw Error('CONFIG');
  const u=new URL(base+'/rest/v1/'+table);Object.entries(q).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u,{...init,headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{}),...(init.headers||{})},cache:'no-store'});
  const d=await r.json().catch(()=>null);if(!r.ok)throw Error('REST');return d as T;
}

export async function POST(req:Request){
  try{
    const s=await requireSession();
    if(s.role==='OWNER') return NextResponse.json({error:'Resident passwords are managed through Firebase. Use password recovery from the sign-in page.'},{status:400});
    const d=schema.parse(await req.json());
    const rows=await rest<any[]>('User',{id:'eq.'+s.id,societyId:'eq.'+s.societyId,select:'id,passwordHash',limit:'1'});
    const user=rows[0];
    if(!user?.passwordHash||!(await bcrypt.compare(d.currentPassword,user.passwordHash))) return NextResponse.json({error:'Current password is incorrect.'},{status:401});
    if(d.currentPassword===d.newPassword) return NextResponse.json({error:'New password must be different from your current password.'},{status:400});
    await rest('User',{id:'eq.'+s.id,societyId:'eq.'+s.societyId},{method:'PATCH',body:JSON.stringify({passwordHash:await bcrypt.hash(d.newPassword,12),updatedAt:new Date().toISOString()})});
    return NextResponse.json({success:true,message:'Password changed successfully. Please sign in again if your session expires.'});
  }catch(e:any){
    const status=e?.name==='ZodError'?400:e?.message==='UNAUTHORIZED'?401:500;
    return NextResponse.json({error:status===400?'Password must be at least 8 characters.':status===401?'Unauthorized':'Unable to change password.'},{status});
  }
}
