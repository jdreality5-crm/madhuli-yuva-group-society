import { NextResponse } from 'next/server';
import { requireOrganizer, prisma } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await requireOrganizer();
    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const start = from ? new Date(`${from}T00:00:00`) : new Date(new Date().getFullYear(), 0, 1);
    const end = to ? new Date(`${to}T23:59:59.999`) : new Date();
    const where = { societyId: session.societyId, date: { gte: start, lte: end } };

    const [income, expense, society] = await Promise.all([
      prisma.income.findMany({
        where,
        orderBy: { date: 'asc' },
        include: { event: { select: { title: true } } },
      }),
      prisma.expense.findMany({
        where,
        orderBy: { date: 'asc' },
        include: { event: { select: { title: true } } },
      }),
      prisma.society.findUnique({ where: { id: session.societyId } }),
    ]);

    const inc = income.reduce((total, row) => total + row.amountPaise, 0n);
    const exp = expense.reduce((total, row) => total + row.amountPaise, 0n);
    const money = (value: bigint) => `₹ ${(Number(value) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const esc = (value: unknown) => String(value ?? '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]!);

    const incomeRows = income.map((row) =>
      `<tr><td>${new Date(row.date).toLocaleDateString('en-IN')}</td><td>${esc(row.event?.title || '—')}</td><td>${esc(row.category || '—')}</td><td>${esc(row.receivedFrom || '—')}</td><td class="amt">${money(row.amountPaise)}</td></tr>`,
    ).join('');

    const expenseRows = expense.map((row) =>
      `<tr><td>${new Date(row.date).toLocaleDateString('en-IN')}</td><td>${esc(row.event?.title || '—')}</td><td>${esc(row.category || '—')}</td><td>${esc(row.paidTo || '—')}</td><td class="amt">${money(row.amountPaise)}</td></tr>`,
    ).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Society Financial Report</title><style>@page{size:A4;margin:16mm 14mm}body{font-family:'Noto Sans Gujarati',Arial,sans-serif;color:#292326;background:#fff}.head{border-bottom:4px solid #b28a3b;padding:8px 0 14px;margin-bottom:18px}.brand{color:#681f2b;font-size:22px;font-weight:800}.sub{color:#746d68;font-size:11px}.title{font-size:20px;color:#681f2b;margin:18px 0 5px}.meta{font-size:11px;color:#746d68}.cards{display:flex;gap:10px;margin:18px 0}.card{flex:1;border:1px solid #e6ddd2;border-radius:8px;padding:12px}.label{font-size:10px;color:#746d68}.value{font-size:17px;color:#681f2b;font-weight:700;margin-top:5px}h2{font-size:14px;color:#681f2b;border-bottom:1px solid #e6ddd2;padding-bottom:7px;margin-top:22px}table{width:100%;border-collapse:collapse;font-size:9px}th{background:#681f2b;color:white;text-align:left;padding:7px}td{padding:6px;border-bottom:1px solid #eee}.amt{text-align:right;font-weight:600}.foot{margin-top:30px;border-top:1px solid #e6ddd2;padding-top:10px;font-size:9px;color:#746d68;display:flex;justify-content:space-between}.sign{margin-top:35px;text-align:right;color:#681f2b;font-weight:700}</style></head><body><div class="head"><div class="brand">${esc(society?.name || 'Society Function Management')}</div><div class="sub">${esc(society?.address || '')} ${esc(society?.city || '')} ${esc(society?.state || '')}</div></div><div class="title">Financial Report / નાણાકીય અહેવાલ</div><div class="meta">Period: ${start.toLocaleDateString('en-IN')} — ${end.toLocaleDateString('en-IN')} • Generated: ${new Date().toLocaleString('en-IN')}</div><div class="cards"><div class="card"><div class="label">TOTAL INCOME</div><div class="value">${money(inc)}</div></div><div class="card"><div class="label">TOTAL EXPENSE</div><div class="value">${money(exp)}</div></div><div class="card"><div class="label">BALANCE</div><div class="value">${money(inc - exp)}</div></div></div><h2>Income Details / આવક</h2><table><thead><tr><th>Date</th><th>Event</th><th>Category</th><th>Received From</th><th>Amount</th></tr></thead><tbody>${incomeRows}</tbody></table><h2>Expense Details / ખર્ચ</h2><table><thead><tr><th>Date</th><th>Event</th><th>Category</th><th>Paid To</th><th>Amount</th></tr></thead><tbody>${expenseRows}</tbody></table><div class="sign">Authorized Organizer<br/>${esc(society?.authorizedSignatory || '')}</div><div class="foot"><span>${esc(society?.reportFooter || 'Society Administration Report')}</span><span>Page generated digitally</span></div></body></html>`;
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline; filename="society-financial-report.html"',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
