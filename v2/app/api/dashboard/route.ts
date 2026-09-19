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

export async function GET() {
  try {
    const session = await requireSession();
    const societyRows = await supabaseRest<any[]>('Society', { id: 'eq.' + session.societyId, select: 'id,name,address,city,state,logoUrl,contact', limit: '1' });
    const [upcomingEvents, notices, photos] = await Promise.all([
      supabaseRest<any[]>('Event', { societyId: 'eq.' + session.societyId, status: 'eq.PUBLISHED', date: 'gte.' + new Date().toISOString(), order: 'date.asc', limit: '6', select: 'id,title,gujaratiTitle,date,time,location,description,imageUrl' }),
      supabaseRest<any[]>('Notice', { societyId: 'eq.' + session.societyId, status: 'eq.PUBLISHED', order: 'date.desc', limit: '8', select: 'id,title,gujaratiTitle,content,gujaratiContent,date,important,imageUrl' }),
      supabaseRest<any[]>('Photo', { societyId: 'eq.' + session.societyId, order: 'createdAt.desc', limit: '12', select: 'id,title,fileUrl,altText,albumName,eventId' }),
    ]);
    const society = societyRows[0] || null;
    if (session.role === 'OWNER') return NextResponse.json({ role: session.role, permissions: session.permissions, society, upcomingEvents, notices, photos });
    const [income, expense, flats, events] = await Promise.all([
      supabaseRest<any[]>('Income', { societyId: 'eq.' + session.societyId, select: 'amountPaise' }),
      supabaseRest<any[]>('Expense', { societyId: 'eq.' + session.societyId, select: 'amountPaise' }),
      supabaseRest<any[]>('Flat', { societyId: 'eq.' + session.societyId, status: 'eq.ACTIVE', select: 'id' }),
      supabaseRest<any[]>('Event', { societyId: 'eq.' + session.societyId, select: 'id' }),
    ]);
    const total = (rows:any[]) => rows.reduce((sum, row) => sum + BigInt(row.amountPaise ?? 0), 0n);
    const totalIncome = total(income), totalExpense = total(expense);
    return NextResponse.json({ role: session.role, society, upcomingEvents, notices, photos, stats: { totalIncome: totalIncome.toString(), totalExpense: totalExpense.toString(), balance: (totalIncome - totalExpense).toString(), flats: flats.length, events: events.length } });
  } catch (e) {
    const status = e instanceof Error && e.message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Server error' }, { status });
  }
}
