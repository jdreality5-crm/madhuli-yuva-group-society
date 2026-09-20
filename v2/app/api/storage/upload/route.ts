import { NextResponse } from 'next/server';
import { requireOrganizer } from '@/lib/auth';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024;

function ascii(bytes: Uint8Array, start: number, end: number) {
  return new TextDecoder().decode(bytes.slice(start, end));
}

function hasValidSignature(bytes: Uint8Array, extension: string) {
  if (extension === 'jpg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === 'png') return bytes.length >= 8 && Array.from(bytes.slice(0, 8)).join(',') === '137,80,78,71,13,10,26,10';
  if (extension === 'webp') return bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP';
  if (extension === 'pdf') return bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-';
  return false;
}

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

    if (folder === 'payment-qrs' && session.role !== 'MASTER_ADMIN') {
      return NextResponse.json({ error: 'Master Admin access required for payment QR uploads.' }, { status: 403 });
    }

    if (!(file instanceof File)) return NextResponse.json({ error: 'File is required.' }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: 'File must be between 1 byte and 5 MB.' }, { status: 400 });
    const extension = ALLOWED[file.type];
    if (!extension) return NextResponse.json({ error: 'Only JPG, PNG, WEBP and PDF files are allowed.' }, { status: 400 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidSignature(bytes, extension)) return NextResponse.json({ error: 'The file content does not match its declared file type.' }, { status: 400 });

    const safeName = `${crypto.randomUUID()}.${extension}`;
    const path = `${session.societyId}/${folder}/${safeName}`;
    const { error } = await getSupabaseAdmin().storage.from(STORAGE_BUCKET).upload(path, bytes, {
      contentType: file.type,
      upsert: false,
      cacheControl: '3600',
    });
    if (error) return NextResponse.json({ error: 'Storage upload failed.' }, { status: 502 });
    return NextResponse.json({ path, bucket: STORAGE_BUCKET });
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    const status = message === 'FORBIDDEN' ? 403 : 500;
    console.error('Storage upload failed', message);
    return NextResponse.json({ error: status === 403 ? 'Organizer access required' : 'Server error' }, { status });
  }
}
