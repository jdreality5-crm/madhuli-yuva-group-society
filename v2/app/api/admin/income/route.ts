import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSubAdminPermission } from '@/lib/session';
async function rest<T>(table:string,q:Record<string,string>,init?:RequestInit){const b=process.env.SUPABASE_URL?.trim().replace(/\/$/,'');const k=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!b||!k)throw Error('CONFIG');const u=new URL(b+'/rest/v1/'+table);Object.entries(q).forEach(([a,v])=>u.searchParams.set(a,v));const r=await fetch(u,{...init,headers:{apikey:k,Authorization:'Bearer '+k,Accept:'application/json',...(init?.body?{'Content-Type':'application/json','Prefer':'return=representation'}:{}),...(init?.headers||{})},cache:'no-store'});const d=await r.json().catch(()=>null);if(!r.ok)throw Error('REST');return d as T}

const schema = z.object({ date: z.coerce.date(), eventId: z.string().optional(), category: z.string().max(100).optional(), description: z.string().max(500).optional(), receivedFrom: z.string().max(160).optional(), amountPaise: z.coerce.bigint().positive(), paymentMethod: z.enum(['CASH','BANK_TRANSFER','UPI','CHEQUE','OTHER']), referenceNumber: z.string().max(120).optional(), notes: z.string().max(1000).optional() });

export async function GET(req: Request) {
  try { const s = await requireSubAdminPermission('INCOME'); const url = new URL(req.url); const rows = await rest<any[]>('Income',{select:'*,Event:eventId(id,title)',societyId:'eq.'+s.societyId,...(url.searchParams.get('category')?{category:'eq.'+url.searchParams.get('category')}:{}),order:'date.desc'}); return NextResponse.json(rows.map(x => ({ ...x, amountPaise: x.amountPaise.toString() }))); }
  catch (e) { return NextResponse.json({ error: e instanceof Error && e.message === 'FORBIDDEN' ? 'Forbidden' : 'Server error' }, { status: 403 }); }
}

export async function POST(req: Request) {
  try {
    const s = await requireSubAdminPermission('INCOME');
    const d = schema.parse(await req.json());
    const eventId = d.eventId?.trim() || null;
    if (eventId) {
      const event=(await rest<any[]>('Event',{select:'id',id:'eq.'+eventId,societyId:'eq.'+s.societyId}))[0];
      if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const row=(await rest<any[]>('Income',{select:'*'},{method:'POST',body:JSON.stringify({...d,eventId,societyId:s.societyId,createdById:s.id,date:d.date.toISOString()})}))[0];
    return NextResponse.json({ ...row, amountPaise: row.amountPaise.toString() }, { status: 201 });
  }
  catch (e) { return NextResponse.json({ error: e instanceof Error && e.message === 'FORBIDDEN' ? 'Forbidden' : 'Invalid request' }, { status: 403 }); }
}
