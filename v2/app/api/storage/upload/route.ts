import { NextResponse } from 'next/server';
import { requireOrganizer } from '@/lib/auth';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export async function POST(req: Request) {
  try {
    const session = await requireOrganizer();
    const form = await req.formData();
    const file = form.get('file');
    const folder = String(form.get('folder') || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'uploads';
    if (!(file instanceof File)) return NextResponse.json({ error: 'File is required.' }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: 'File must be between 1 byte and 5 MB.' }, { status: 400 });
    const extension = ALLOWED[file.type];
    if (!extension) return NextResponse.json({ error: 'Only JPG, PNG, WEBP and PDF files are allowed.' }, { status: 400 });
    const safeName = `${crypto.randomUUID()}.${extension}`;
    const path = `${session.societyId}/${folder}/${safeName}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error } = await getSupabaseAdmin().storage.from(STORAGE_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: '3600' });
    if (error) return NextResponse.json({ error: 'Storage upload failed.' }, { status: 502 });
    return NextResponse.json({ path, bucket: STORAGE_BUCKET });
  } catch (e) {
    const status = e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? 'Organizer access required' : 'Server error' }, { status });
  }
}
