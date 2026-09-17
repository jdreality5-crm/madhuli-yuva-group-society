import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, requireSession } from '@/lib/auth';
import { createSignedFileUrl, getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase-admin';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED = new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]);
const schema = z.object({ name: z.string().trim().min(2).max(120), mobile: z.string().trim().min(7).max(20), email: z.string().trim().email().max(320) });

export async function GET() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findFirst({ where: { id: session.id, societyId: session.societyId }, select: { id:true,name:true,email:true,mobile:true,role:true,profileImageUrl:true,residentType:true,unit:{ select:{ id:true,label:true,floorLabel:true,property:{select:{id:true,name:true,type:true,propertyNumber:true,block:true}}}} } });
    if (!user) return NextResponse.json({ error:'Profile not found' }, { status:404 });
    return NextResponse.json({ profile: { ...user, profileImageUrl: user.profileImageUrl ? await createSignedFileUrl(user.profileImageUrl) : null } });
  } catch (e:any) { return NextResponse.json({ error:e?.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load profile' }, { status:e?.message === 'UNAUTHORIZED' ? 401 : 500 }); }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const body = schema.parse(await req.json());
    const duplicate = await prisma.user.findFirst({ where:{ email:body.email.toLowerCase(), NOT:{id:session.id} } });
    if (duplicate) return NextResponse.json({error:'Email is already in use.'},{status:409});
    const user = await prisma.user.update({ where:{id:session.id}, data:{name:body.name,email:body.email.toLowerCase(),mobile:body.mobile} , select:{id:true,name:true,email:true,mobile:true,role:true,profileImageUrl:true} });
    return NextResponse.json({profile:user});
  } catch(e:any) { return NextResponse.json({error:e?.name==='ZodError'?'Invalid profile details':e?.message||'Unable to update profile'},{status:e?.name==='ZodError'?400:500}); }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.startsWith('multipart/form-data')) return NextResponse.json({error:'Use multipart/form-data.'},{status:400});
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({error:'Image file is required.'},{status:400});
    const extension = ALLOWED.get(file.type);
    if (!extension) return NextResponse.json({error:'Only JPG, PNG, or WebP images are allowed.'},{status:400});
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({error:'Profile image must be 3 MB or smaller.'},{status:400});
    const user = await prisma.user.findFirst({where:{id:session.id,societyId:session.societyId},select:{profileImageUrl:true}});
    if (!user) return NextResponse.json({error:'Profile not found.'},{status:404});
    const path = `${session.societyId}/profile-images/${session.id}-${crypto.randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const {error} = await getSupabaseAdmin().storage.from(STORAGE_BUCKET).upload(path,buffer,{contentType:file.type,upsert:false,cacheControl:'3600'});
    if (error) throw error;
    await prisma.user.update({where:{id:session.id},data:{profileImageUrl:path}});
    if (user.profileImageUrl && !user.profileImageUrl.startsWith('http')) await getSupabaseAdmin().storage.from(STORAGE_BUCKET).remove([user.profileImageUrl]);
    return NextResponse.json({profileImageUrl:await createSignedFileUrl(path)});
  } catch(e:any) { return NextResponse.json({error:e?.message||'Unable to upload profile image'},{status:500}); }
}

export async function DELETE() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findFirst({where:{id:session.id,societyId:session.societyId},select:{profileImageUrl:true}});
    if (!user) return NextResponse.json({error:'Profile not found.'},{status:404});
    await prisma.user.update({where:{id:session.id},data:{profileImageUrl:null}});
    if (user.profileImageUrl && !user.profileImageUrl.startsWith('http')) await getSupabaseAdmin().storage.from(STORAGE_BUCKET).remove([user.profileImageUrl]);
    return NextResponse.json({success:true});
  } catch(e:any) { return NextResponse.json({error:e?.message||'Unable to remove profile image'},{status:500}); }
}
