import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { STORAGE_BUCKET } from '@/lib/supabase-admin';

async function rest<T>(table:string,q:Record<string,string>={},init?:RequestInit){const b=process.env.SUPABASE_URL?.trim().replace(/\/$/,'');const k=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!b||!k)throw Error('CONFIG');const u=new URL(b+'/rest/v1/'+table);Object.entries(q).forEach(([a,v])=>u.searchParams.set(a,v));const r=await fetch(u,{...init,headers:{apikey:k,Authorization:'Bearer '+k,Accept:'application/json',...(init?.body?{'Content-Type':'application/json','Prefer':'return=representation'}:{}),...(init?.headers||{})},cache:'no-store'});const d=await r.json().catch(()=>null);if(!r.ok)throw Error('REST');return d as T}
async function sign(path:string){if(!path||/^https?:\/\//.test(path)||path.startsWith('data:'))return path;const b=process.env.SUPABASE_URL?.trim().replace(/\/$/,'');const k=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!b||!k)throw Error('CONFIG');const r=await fetch(b+'/storage/v1/object/sign/'+STORAGE_BUCKET+'/'+path,{method:'POST',headers:{apikey:k,Authorization:'Bearer '+k,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:3600}),cache:'no-store'});const d=await r.json().catch(()=>null);if(!r.ok)throw Error('SIGN');return b+'/storage/v1'+(d?.signedURL||d?.signedUrl||'')}
async function upload(path:string,buffer:Buffer,contentType:string){const b=process.env.SUPABASE_URL?.trim().replace(/\/$/,'');const k=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!b||!k)throw Error('CONFIG');const r=await fetch(b+'/storage/v1/object/'+STORAGE_BUCKET+'/'+path,{method:'POST',headers:{apikey:k,Authorization:'Bearer '+k,'Content-Type':contentType,'x-upsert':'false'},body:buffer});if(!r.ok)throw Error('UPLOAD');return path}
const schema = z.object({ displayName: z.string().trim().min(2).max(100), upiId: z.string().trim().max(100).optional().or(z.literal('')), qrImageUrl: z.string().max(4000000).optional().or(z.literal('')), purpose: z.string().trim().min(2).max(200), instructions: z.string().trim().max(500).optional().or(z.literal('')), ownerUserId: z.string().optional().or(z.literal('')) });


function hasValidSignature(bytes: Buffer, extension: string) {
  if (extension === 'jpg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === 'png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (extension === 'webp') return bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if (extension === 'pdf') return bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  return false;
}

async function storeQr(value: string, societyId: string) {
  if (!value) return null;
  if (!value.startsWith('data:image/')) return value;
  const match = value.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error('INVALID_QR');
  const contentType = match[1];
  const extension = match[2] === 'jpeg' ? 'jpg' : match[2];
  const buffer = Buffer.from(match[3], 'base64');
  if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) throw new Error('QR_TOO_LARGE');
  if (!hasValidSignature(buffer, extension)) throw new Error('INVALID_QR');
  const path = `${societyId}/payment-qrs/${crypto.randomUUID()}.${extension}`;
  await upload(path,buffer,contentType);
  return path;
}

export async function GET() {
  try {
    const session = await requireSession();
    const accounts=await rest<any[]>('PaymentAccount',{select:'id,displayName,upiId,qrImageUrl,purpose,instructions,ownerUserId',societyId:'eq.'+session.societyId,status:'eq.ACTIVE',order:'createdAt.asc'});
    const result = await Promise.all(accounts.map(async a => ({ ...a, qrImageUrl: a.qrImageUrl ? await sign(a.qrImageUrl) : null })));
    return NextResponse.json({ accounts: result });
  } catch (e) { const status = e instanceof Error && e.message === 'UNAUTHORIZED' ? 401 : 500; return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Server error' }, { status }); }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(); if(session.role!=='MASTER_ADMIN') throw new Error('FORBIDDEN');
    const body = schema.parse(await req.json());
    let ownerUserId = body.ownerUserId || null;
    if (ownerUserId) {
      const owner = await prisma.user.findFirst({ where: { id: ownerUserId, societyId: session.societyId, role: { in: ['MASTER_ADMIN', 'ORGANIZER'] }, status: 'ACTIVE' } });
      if (!owner) return NextResponse.json({ error: 'Invalid payment account owner.' }, { status: 400 });
    } else ownerUserId = session.id;
    const qrImageUrl = await storeQr(body.qrImageUrl || '', session.societyId);
    const now=new Date().toISOString(); const account=(await rest<any[]>('PaymentAccount',{select:'*'},{method:'POST',body:JSON.stringify({id:crypto.randomUUID(),societyId:session.societyId,ownerUserId,displayName:body.displayName,upiId:body.upiId||null,qrImageUrl,purpose:body.purpose,instructions:body.instructions||null,createdAt:now,updatedAt:now})}))[0];
    await rest('AuditLog',{}, {method:'POST',body:JSON.stringify({id:crypto.randomUUID(),userId:session.id,action:'CREATE',module:'PAYMENT_ACCOUNT',recordId:account.id,details:`Created payment account ${account.displayName}`,createdAt:now})});
    return NextResponse.json({ account }, { status: 201 });
  } catch (e) { const status = e instanceof z.ZodError ? 400 : e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500; return NextResponse.json({ error: status === 400 ? 'Invalid payment account details.' : status === 403 ? 'Master Admin access required' : 'Server error' }, { status }); }
}
