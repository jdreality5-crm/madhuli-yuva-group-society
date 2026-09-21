import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await requireSession();
    if (session.role !== 'MASTER_ADMIN' && !(session.role === 'ORGANIZER' && (session.permissions.includes('INCOME') || session.permissions.includes('EXPENSES')))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!base || !key) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    const url = new URL(`${base}/rest/v1/Event`);
    url.searchParams.set('select', 'id,title,gujaratiTitle,date');
    url.searchParams.set('societyId', `eq.${session.societyId}`);
    url.searchParams.set('order', 'date.desc');
    const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }, cache: 'no-store' });
    const data = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ error: 'Unable to load programs' }, { status: 502 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Unable to load programs' }, { status: 500 });
  }
}
