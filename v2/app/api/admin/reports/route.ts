import { NextResponse } from 'next/server';
import { requireSubAdminPermission } from '@/lib/session';

async function rest<T>(table: string, q: Record<string, string>) {
  const b = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!b || !k) throw Error('CONFIG');
  const u = new URL(b + '/rest/v1/' + table);
  Object.entries(q).forEach(([a, v]) => u.searchParams.set(a, v));
  const r = await fetch(u, { headers: { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json' }, cache: 'no-store' });
  const d = await r.json().catch(() => null);
  if (!r.ok) {
    console.error('Report query failed', table, r.status, d);
    throw Error('REST');
  }
  return d as T;
}

function parseDate(value: string | null, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function GET(req: Request) {
  try {
    const s = await requireSubAdminPermission('REPORTS');
    const u = new URL(req.url);
    const now = new Date();
    const from = u.searchParams.get('from');
    const to = u.searchParams.get('to');
    const eventId = u.searchParams.get('eventId')?.trim() || '';
    const start = parseDate(from, new Date(Date.UTC(now.getUTCFullYear(), 0, 1)));
    const endDay = parseDate(to, new Date(Date.UTC(now.getUTCFullYear(), 11, 31)));
    const end = new Date(endDay);
    end.setUTCHours(23, 59, 59, 999);
    if (start > end) return NextResponse.json({ error: 'Invalid report date range.' }, { status: 400 });

    const base = { societyId: 'eq.' + s.societyId, date: `gte.${start.toISOString()},lte.${end.toISOString()}`, order: 'date.desc', select: 'amountPaise,category,date,eventId' };
    const incomeQuery = eventId ? { ...base, eventId: 'eq.' + eventId } : base;
    const expenseQuery = eventId ? { ...base, eventId: 'eq.' + eventId } : base;
    const [income, expenses] = await Promise.all([
      rest<any[]>('Income', incomeQuery),
      rest<any[]>('Expense', expenseQuery),
    ]);

    const sum = (rows: any[]) => rows.reduce((a, x) => a + BigInt(x.amountPaise ?? 0), 0n);
    const it = sum(income);
    const et = sum(expenses);
    const cats = (rows: any[]) => {
      const m = new Map<string, bigint>();
      for (const x of rows) {
        const k = x.category || 'Other';
        m.set(k, (m.get(k) || 0n) + BigInt(x.amountPaise ?? 0));
      }
      return [...m].map(([category, amount]) => ({ category, amount: amount.toString() }));
    };

    return NextResponse.json({
      from: start.toISOString(),
      to: end.toISOString(),
      eventId: eventId || null,
      summary: { income: it.toString(), expense: et.toString(), balance: (it - et).toString() },
      income: income.map(x => ({ ...x, amountPaise: String(x.amountPaise ?? 0) })),
      expenses: expenses.map(x => ({ ...x, amountPaise: String(x.amountPaise ?? 0) })),
      incomeByCategory: cats(income),
      expenseByCategory: cats(expenses),
    });
  } catch (e) {
    const status = e instanceof Error && e.message === 'FORBIDDEN' ? 403 : e instanceof Error && e.message === 'REST' ? 502 : 500;
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : status === 502 ? 'Report data query failed' : 'Server error' }, { status });
  }
}
