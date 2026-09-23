import { NextResponse } from 'next/server';
import { requireSubAdminPermission } from '@/lib/session';

async function rest<T>(table: string, q: Record<string, string> = {}) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(q).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Error('REST');
  return data as T;
}

const esc = (value: unknown) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char] || char));
const money = (value: bigint | number | string) => `₹${(Number(value) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const validDate = (value: string | null) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function GET(req: Request) {
  try {
    const session = await requireSubAdminPermission('REPORTS');
    const params = new URL(req.url).searchParams;
    const from = params.get('from');
    const to = params.get('to');
    const eventId = params.get('eventId')?.trim() || '';
    if (!validDate(from) || !validDate(to)) return NextResponse.json({ error: 'Invalid report date. Use YYYY-MM-DD.' }, { status: 400 });
    if (from && to && from > to) return NextResponse.json({ error: 'Report start date cannot be after the end date.' }, { status: 400 });

    const start = from ? new Date(`${from}T00:00:00.000Z`).toISOString() : new Date(new Date().getFullYear(), 0, 1).toISOString();
    const end = to ? new Date(`${to}T23:59:59.999Z`).toISOString() : new Date().toISOString();
    const base = { societyId: `eq.${session.societyId}`, date: `gte.${start}`, select: '*', order: 'date.desc' };
    const incomeQuery = eventId ? { ...base, eventId: `eq.${eventId}` } : base;
    const expenseQuery = eventId ? { ...base, eventId: `eq.${eventId}` } : base;
    const [incomeRows, expenseRows, societies, events] = await Promise.all([
      rest<any[]>('Income', incomeQuery),
      rest<any[]>('Expense', expenseQuery),
      rest<any[]>('Society', { select: 'name', id: `eq.${session.societyId}`, limit: '1' }),
      eventId ? rest<any[]>('Event', { select: 'title,gujaratiTitle,date', id: `eq.${eventId}`, societyId: `eq.${session.societyId}`, limit: '1' }) : Promise.resolve([]),
    ]);

    const income = incomeRows.filter((row) => new Date(row.date) <= new Date(end));
    const expenses = expenseRows.filter((row) => new Date(row.date) <= new Date(end));
    const totalIncome = income.reduce((sum, row) => sum + BigInt(String(row.amountPaise || 0)), 0n);
    const totalExpense = expenses.reduce((sum, row) => sum + BigInt(String(row.amountPaise || 0)), 0n);
    const societyName = societies[0]?.name || 'Society';
    const eventName = events[0]?.gujaratiTitle || events[0]?.title || '';
    const reportTitle = eventName ? `Program Financial Report · ${eventName}` : 'Society Financial Report';
    const rows = (items: any[], type: 'Income' | 'Expense') => items.map((row) => `<tr><td>${esc(new Date(row.date).toLocaleDateString('en-IN'))}</td><td>${esc(row.category || 'Other')}</td><td>${esc(row.description || '—')}</td><td>${esc(row.receivedFrom || row.paidTo || '—')}</td><td class="amount">${esc(money(String(row.amountPaise || 0)))}</td></tr>`).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(reportTitle)}</title><style>
      :root{--maroon:#541b2a;--gold:#b99a58;--ink:#2b2522;--muted:#756a63;--ivory:#fbf8f2}
      *{box-sizing:border-box}body{margin:0;background:#eee8df;color:var(--ink);font-family:Arial,'Noto Sans Gujarati',sans-serif}.sheet{max-width:1060px;margin:24px auto;background:#fff;padding:42px 46px;box-shadow:0 12px 40px rgba(50,20,20,.12)}.header{border-top:5px solid var(--maroon);border-bottom:1px solid var(--gold);padding:0 0 18px;margin-bottom:22px}.brand{font-size:12px;letter-spacing:2px;color:var(--gold);font-weight:700;text-transform:uppercase}.title{font-size:30px;line-height:1.2;color:var(--maroon);margin:8px 0}.meta{color:var(--muted);font-size:12px;line-height:1.7}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0}.summary-card{border:1px solid #e5d9c7;border-top:3px solid var(--gold);background:var(--ivory);padding:16px}.label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}.value{font-size:23px;font-weight:700;color:var(--maroon);margin-top:7px}h2{font-size:17px;color:var(--maroon);border-bottom:1px solid #eadfce;padding-bottom:8px;margin:26px 0 10px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:var(--maroon);color:#fff;text-align:left;padding:9px}td{border-bottom:1px solid #eee5da;padding:8px;vertical-align:top}tr:nth-child(even) td{background:#fcfaf7}.amount{text-align:right;white-space:nowrap;font-weight:700}.footer{border-top:1px solid var(--gold);margin-top:32px;padding-top:12px;display:flex;justify-content:space-between;color:var(--muted);font-size:10px}@media(max-width:700px){.sheet{margin:0;padding:24px 16px}.summary{grid-template-columns:1fr}.title{font-size:24px}table{font-size:9px}th,td{padding:6px}.footer{display:block;line-height:1.7}}@media print{body{background:#fff}.sheet{max-width:none;margin:0;padding:18mm 14mm;box-shadow:none}.no-print{display:none}thead{display:table-header-group}tr{break-inside:avoid}}
    </style></head><body><main class="sheet"><header class="header"><div class="brand">Madhuli Yuva Group Society</div><h1 class="title">${esc(reportTitle)}</h1><div class="meta">${esc(societyName)} · Period: ${esc(from || 'Year start')} to ${esc(to || 'Today')} · ${eventName ? 'Program-specific' : 'All programs'}</div></header><section class="summary"><div class="summary-card"><div class="label">Total Income</div><div class="value">${money(totalIncome)}</div></div><div class="summary-card"><div class="label">Total Expense</div><div class="value">${money(totalExpense)}</div></div><div class="summary-card"><div class="label">Balance</div><div class="value">${money(totalIncome - totalExpense)}</div></div></section><h2>Income Register / આવક</h2><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Received From</th><th>Amount</th></tr></thead><tbody>${rows(income, 'Income') || '<tr><td colspan="5">No income records found.</td></tr>'}</tbody></table><h2>Expense Register / ખર્ચ</h2><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid To</th><th>Amount</th></tr></thead><tbody>${rows(expenses, 'Expense') || '<tr><td colspan="5">No expense records found.</td></tr>'}</tbody></table><footer class="footer"><span>Generated from society records · Authorized financial access only</span><span>Master Admin / Sub Admin Accountant</span></footer></main></body></html>`;
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Server error' }, { status });
  }
}
