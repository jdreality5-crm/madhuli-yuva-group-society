import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/session';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED = new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]);

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  mobile: z.string().trim().min(7).max(20),
  email: z.string().trim().email().max(320),
});

async function supabaseRest<T>(table: string, params: Record<string,string>, init: RequestInit = {}): Promise<T> {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('SUPABASE server configuration is missing');
  const url = new URL(base + '/rest/v1/' + table);
  Object.entries(params).forEach(([name,value]) => url.searchParams.set(name,value));
  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      apikey:key,
      Authorization:'Bearer '+key,
      Accept:'application/json',
      ...(init.body ? {'Content-Type':'application/json'} : {}),
      ...(init.headers || {}),
    },
    cache:'no-store',
  });
  const data = await response.json().catch(()=>null);
  if (!response.ok) throw new Error('Supabase '+table+' request failed');
  return data as T;
}

function storageConfig() {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'society-files';
  if (!base || !key) throw new Error('SUPABASE server configuration is missing');
  return { base, key, bucket };
}

async function signedFileUrl(path:string, expiresIn=3600) {
  if (!path) return null;
  if (/^(https?:|data:)/i.test(path)) return path;
  const {base,key,bucket}=storageConfig();
  const response=await fetch(base+'/storage/v1/object/sign/'+encodeURIComponent(bucket)+'/'+path.split('/').map(encodeURIComponent).join('/'),{
    method:'POST',
    headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({expiresIn}),
    cache:'no-store',
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok || !data?.signedURL) throw new Error('Unable to create profile image URL');
  return data.signedURL.startsWith('http') ? data.signedURL : base+'/storage/v1'+data.signedURL;
}

async function deleteStorageObject(path:string) {
  const {base,key,bucket}=storageConfig();
  const response=await fetch(base+'/storage/v1/object/'+encodeURIComponent(bucket)+'/'+path.split('/').map(encodeURIComponent).join('/'),{
    method:'DELETE',
    headers:{apikey:key,Authorization:'Bearer '+key},
    cache:'no-store',
  });
  if(!response.ok && response.status!==404) throw new Error('Unable to remove previous profile image');
}

async function getProfile(session:Awaited<ReturnType<typeof requireSession>>) {
  const users=await supabaseRest<any[]>('User',{
    id:'eq.'+session.id,
    societyId:'eq.'+session.societyId,
    select:'id,name,email,mobile,role,profileImageUrl,residentType,status,approvalStatus,emailVerified,emailLockedUntil,mobileLockedUntil,unitId',
    limit:'1',
  });
  const user=users[0];
  if(!user) return null;

  let unit=null;
  if(user.unitId){
    const units=await supabaseRest<any[]>('PropertyUnit',{id:'eq.'+user.unitId,select:'id,label,floorLabel,propertyId',limit:'1'});
    const rawUnit=units[0];
    if(rawUnit?.propertyId){
      const properties=await supabaseRest<any[]>('Property',{id:'eq.'+rawUnit.propertyId,societyId:'eq.'+session.societyId,select:'id,name,type,propertyNumber,block',limit:'1'});
      unit=properties[0] ? {...rawUnit,property:properties[0]} : null;
    }
  }

  return {
    ...user,
    profileImageUrl:user.profileImageUrl ? await signedFileUrl(user.profileImageUrl) : null,
    unit,
  };
}

export async function GET() {
  try {
    const session=await requireSession();
    const profile=await getProfile(session);
    if(!profile) return NextResponse.json({error:'Profile not found'},{status:404});
    return NextResponse.json({profile});
  } catch(e:any) {
    const unauthorized=e?.message==='UNAUTHORIZED';
    return NextResponse.json({error:unauthorized?'Unauthorized':'Unable to load profile'},{status:unauthorized?401:500});
  }
}

export async function PATCH(req:Request) {
  try {
    const session=await requireSession();
    const body=schema.parse(await req.json());
    if(body.email.toLowerCase()!==session.email.toLowerCase()) {
      return NextResponse.json({error:'Email cannot be changed from Profile. Email changes require a separate verification flow.'},{status:400});
    }

    const currentRows=await supabaseRest<any[]>('User',{
      id:'eq.'+session.id,
      societyId:'eq.'+session.societyId,
      select:'id,email,mobile,mobileLockedUntil',
      limit:'1',
    });
    const current=currentRows[0];
    if(!current) return NextResponse.json({error:'Profile not found'},{status:404});

    const now=new Date();
    const mobileChanged=body.mobile!==String(current.mobile||'');
    if(mobileChanged && current.mobileLockedUntil && new Date(current.mobileLockedUntil)>now) {
      return NextResponse.json({error:'Mobile number is locked for 15 days after account activation.'},{status:409});
    }

    if(mobileChanged) {
      const duplicate=await supabaseRest<any[]>('User',{
        societyId:'eq.'+session.societyId,
        mobile:'eq.'+body.mobile,
        id:'neq.'+session.id,
        select:'id',
        limit:'1',
      });
      if(duplicate.length) return NextResponse.json({error:'This mobile number is already registered in the society.'},{status:409});
    }

    const rows=await supabaseRest<any[]>('User',{
      id:'eq.'+session.id,
      societyId:'eq.'+session.societyId,
    },{
      method:'PATCH',
      body:JSON.stringify({name:body.name,mobile:body.mobile,updatedAt:new Date().toISOString()}),
      headers:{Prefer:'return=representation'},
    });
    const user=rows[0];
    if(!user) return NextResponse.json({error:'Profile update failed'},{status:500});
    return NextResponse.json({profile:{id:user.id,name:user.name,email:user.email,mobile:user.mobile,role:user.role,profileImageUrl:user.profileImageUrl||null}});
  } catch(e:any) {
    return NextResponse.json({error:e?.name==='ZodError'?'Invalid profile details':e?.message||'Unable to update profile'},{status:e?.name==='ZodError'?400:500});
  }
}

export async function POST(req:Request) {
  try {
    const session=await requireSession();
    const contentType=req.headers.get('content-type')||'';
    if(!contentType.startsWith('multipart/form-data')) return NextResponse.json({error:'Use multipart/form-data.'},{status:400});
    const form=await req.formData();
    const file=form.get('file');
    if(!(file instanceof File)) return NextResponse.json({error:'Image file is required.'},{status:400});
    const extension=ALLOWED.get(file.type);
    if(!extension) return NextResponse.json({error:'Only JPG, PNG, or WebP images are allowed.'},{status:400});
    if(file.size>MAX_IMAGE_BYTES) return NextResponse.json({error:'Profile image must be 3 MB or smaller.'},{status:400});

    const users=await supabaseRest<any[]>('User',{id:'eq.'+session.id,societyId:'eq.'+session.societyId,select:'profileImageUrl',limit:'1'});
    const user=users[0];
    if(!user) return NextResponse.json({error:'Profile not found.'},{status:404});

    const path=session.societyId+'/profile-images/'+session.id+'-'+crypto.randomUUID()+'.'+extension;
    const {base,key,bucket}=storageConfig();
    const upload=await fetch(base+'/storage/v1/object/'+encodeURIComponent(bucket)+'/'+path.split('/').map(encodeURIComponent).join('/'),{
      method:'POST',
      headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':file.type,'x-upsert':'false','cache-control':'3600'},
      body:await file.arrayBuffer(),
      cache:'no-store',
    });
    const uploadData=await upload.json().catch(()=>null);
    if(!upload.ok) throw new Error(uploadData?.message||'Unable to upload profile image');

    await supabaseRest('User',{id:'eq.'+session.id,societyId:'eq.'+session.societyId},{
      method:'PATCH',
      body:JSON.stringify({profileImageUrl:path,updatedAt:new Date().toISOString()}),
      headers:{Prefer:'return=minimal'},
    });

    if(typeof user.profileImageUrl==='string' && user.profileImageUrl.startsWith(session.societyId+'/profile-images/'+session.id+'-')) {
      await deleteStorageObject(user.profileImageUrl);
    }

    return NextResponse.json({profileImageUrl:await signedFileUrl(path)});
  } catch(e:any) {
    const unauthorized=e?.message==='UNAUTHORIZED';
    return NextResponse.json({error:unauthorized?'Unauthorized':e?.message||'Unable to upload profile image'},{status:unauthorized?401:500});
  }
}

export async function DELETE() {
  try {
    const session=await requireSession();
    const users=await supabaseRest<any[]>('User',{id:'eq.'+session.id,societyId:'eq.'+session.societyId,select:'profileImageUrl',limit:'1'});
    const user=users[0];
    if(!user) return NextResponse.json({error:'Profile not found.'},{status:404});

    await supabaseRest('User',{id:'eq.'+session.id,societyId:'eq.'+session.societyId},{
      method:'PATCH',
      body:JSON.stringify({profileImageUrl:null,updatedAt:new Date().toISOString()}),
      headers:{Prefer:'return=minimal'},
    });
    if(typeof user.profileImageUrl==='string' && user.profileImageUrl.startsWith(session.societyId+'/profile-images/'+session.id+'-')) {
      await deleteStorageObject(user.profileImageUrl);
    }
    return NextResponse.json({success:true});
  } catch(e:any) {
    const unauthorized=e?.message==='UNAUTHORIZED';
    return NextResponse.json({error:unauthorized?'Unauthorized':e?.message||'Unable to remove profile image'},{status:unauthorized?401:500});
  }
}
