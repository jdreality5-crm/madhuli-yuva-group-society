import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';

async function supabaseRest<T>(table: string, params: Record<string,string>): Promise<T> {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('Supabase server configuration is missing');
  const url = new URL(base + '/rest/v1/' + table);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url.toString(), { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' }, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error('Supabase ' + table + ' request failed');
  return data as T;
}

const bucket = () => process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'society-files';

async function mediaUrl(value: string | null | undefined, societyId: string) {
  if (!value || /^https?:\/\//.test(value) || value.startsWith('data:')) return value || null;
  if (!value.startsWith(`${societyId}/`) || value.includes('..') || value.includes('\\') || value.includes('\0')) return null;
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('Supabase server configuration is missing');
  const response = await fetch(base + '/storage/v1/object/sign/' + bucket() + '/' + value, {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 3600 }),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return null;
  return base + '/storage/v1' + (data?.signedURL || data?.signedUrl || '');
}

type PropertyRow = { id: string };

export async function GET() {
  try {
    const session = await requireSession();
    const societyRows = await supabaseRest<any[]>('Society', { id: 'eq.' + session.societyId, select: 'id,name,address,city,state,logoUrl,contact', limit: '1' });
    const [upcomingEvents, notices, photos] = await Promise.all([
      supabaseRest<any[]>('Event', { societyId: 'eq.' + session.societyId, status: 'eq.PUBLISHED', date: 'gte.' + new Date().toISOString(), order: 'date.asc', limit: '6', select: 'id,title,gujaratiTitle,date,time,location,description,imageUrl' }),
      supabaseRest<any[]>('Notice', { societyId: 'eq.' + session.societyId, status: 'eq.PUBLISHED', order: 'date.desc', limit: '8', select: 'id,title,gujaratiTitle,content,gujaratiContent,date,important,imageUrl' }),
      supabaseRest<any[]>('Photo', { societyId: 'eq.' + session.societyId, order: 'createdAt.desc', limit: '12', select: 'id,title,fileUrl,altText,albumName,eventId' }),
    ]);
    const society = societyRows[0] ? { ...societyRows[0], logoUrl: await mediaUrl(societyRows[0].logoUrl, session.societyId) } : null;
    const signedEvents = await Promise.all(upcomingEvents.map(async event => ({ ...event, imageUrl: await mediaUrl(event.imageUrl, session.societyId) })));
    const signedNotices = await Promise.all(notices.map(async notice => ({ ...notice, imageUrl: await mediaUrl(notice.imageUrl, session.societyId) })));
    const signedPhotos = await Promise.all(photos.map(async photo => ({ ...photo, fileUrl: await mediaUrl(photo.fileUrl, session.societyId) })));
    if (session.role === 'OWNER') return NextResponse.json({ role: session.role, permissions: session.permissions, society, upcomingEvents: signedEvents, notices: signedNotices, photos: signedPhotos });
    const properties = await supabaseRest<PropertyRow[]>('Property', { societyId: 'eq.' + session.societyId, status: 'eq.ACTIVE', select: 'id' });
    const propertyIds = properties.map(property => property.id);
    const [income, expense, propertyUnits, events] = await Promise.all([
      supabaseRest<any[]>('Income', { societyId: 'eq.' + session.societyId, select: 'amountPaise' }),
      supabaseRest<any[]>('Expense', { societyId: 'eq.' + session.societyId, select: 'amountPaise' }),
      propertyIds.length ? supabaseRest<any[]>('PropertyUnit', { propertyId: 'in.(' + propertyIds.join(',') + ')', status: 'eq.ACTIVE', select: 'id' }) : Promise.resolve([]),
      supabaseRest<any[]>('Event', { societyId: 'eq.' + session.societyId, select: 'id' }),
    ]);
    const total = (rows:any[]) => rows.reduce((sum, row) => sum + BigInt(row.amountPaise ?? 0), 0n);
    const canViewIncome = session.role === 'MASTER_ADMIN' || session.permissions?.includes('*') || session.permissions?.includes('INCOME');
    const canViewExpenses = session.role === 'MASTER_ADMIN' || session.permissions?.includes('*') || session.permissions?.includes('EXPENSES');
    const totalIncome = canViewIncome ? total(income) : 0n;
    const totalExpense = canViewExpenses ? total(expense) : 0n;
    return NextResponse.json({ role: session.role, society, upcomingEvents: signedEvents, notices: signedNotices, photos: signedPhotos, stats: { totalIncome: totalIncome.toString(), totalExpense: totalExpense.toString(), balance: (totalIncome - totalExpense).toString(), flats: propertyUnits.length, events: events.length } });
  } catch (e) {
    const status = e instanceof Error && e.message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Server error' }, { status });
  }
}
