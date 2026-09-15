import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'society-files';

export function getSupabaseAdmin() {
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createSignedFileUrl(path: string, expiresIn = 3600) {
  if (!path) return null;
  if (path.startsWith('https://') || path.startsWith('http://') || path.startsWith('data:')) return path;
  const { data, error } = await getSupabaseAdmin().storage.from(STORAGE_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
