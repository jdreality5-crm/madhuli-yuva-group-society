import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { requireSubAdminPermission } from '@/lib/session';

const W = 595;
const H = 842;
const M = 34;
const TOP = 770;
const BOTTOM = 72;
const ink = rgb(0.14, 0.12, 0.11);
const maroon = rgb(0.35, 0.04, 0.04);
const gold = rgb(0.72, 0.58, 0.30);
const pale = rgb(0.96, 0.93, 0.87);
const clean = (value: unknown) => String(value ?? '-').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() || '-';
const money = (value: unknown) => `Rs. ${(Number(value || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateText = (value: unknown) => { const date = new Date(String(value || '')); return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN'); };

type Row = { date?: unknown; category?: unknown; description?: unknown; receivedFrom?: unknown; paidTo?: unknown; amountPaise?: unknown; paymentMethod?: unknown };

async function rest<T>(table: string, query: Record<string, string>): Promise<T> {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`REST_${response.status}`);
  return response.json() as Promise<T>;
}

export async function GET(req: Request) {
  try {
    const session = await requireSubAdminPermission('REPORTS');
    const params = new URL(req.url).searchParams;
    const from = params.get('from');
    const to = params.get('to');
    if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) || (from && to && from > to)) return NextResponse.json({ error: 'Invalid report date range.' }, { status: 400 });
    const start = from ? `${from}T00:00:00.000Z` : `${new Date().getUTCFullYear()}-01-01T00:00:00.000Z`;
    const end = to ? `${to}T23:59:59.999Z` : new Date().toISOString();
    const base = { societyId: `eq.${session.societyId}`, and: `(date.gte.${start},date.lte.${end})`, order: 'date.desc' };
    const [income, expenses] = await Promise.all([
      rest<Row[]>('Income', { ...base, select: 'date,category,description,receivedFrom,amountPaise,paymentMethod' }),
      rest<Row[]>('Expense', { ...base, select: 'date,category,description,paidTo,amountPaise,paymentMethod' }),
    ]);
    const incomeTotal = income.reduce((sum, row) => sum + Number(row.amountPaise || 0), 0);
    const expenseTotal = expenses.reduce((sum, row) => sum + Number(row.amountPaise || 0), 0);
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page: PDFPage;
    let y = TOP;

    const newPage = () => {
      page = pdf.addPage([W, H]);
      y = TOP;
      page.drawText('Society Financial Report', { x: M, y, size: 14, font: bold, color: maroon });
      y -= 22;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, color: gold, thickness: 1 });
      y -= 18;
    };
    const ensure = (height: number) => { if (y - height < BOTTOM) newPage(); };
    const text = (value: unknown, x: number, size: number, font: PDFFont = regular, color = ink) => page.drawText(clean(value).slice(0, 48), { x, y, size, font, color });
    const header = (title: string) => {
      ensure(32);
      page.drawRectangle({ x: M, y: y - 5, width: W - M * 2, height: 20, color: maroon });
      page.drawText(title, { x: M + 7, y, size: 9, font: bold, color: rgb(1, 1, 1) });
      y -= 28;
    };
    const tableHeader = () => {
      ensure(22);
      page.drawRectangle({ x: M, y: y - 4, width: W - M * 2, height: 18, color: pale, borderColor: gold, borderWidth: 0.5 });
      text('Date', M + 5, 7, bold, maroon); text('Category / Description', M + 76, 7, bold, maroon); text('Party', M + 292, 7, bold, maroon); text('Amount', M + 435, 7, bold, maroon);
      y -= 23;
    };
    const tableRow = (row: Row, party: unknown) => {
      ensure(18);
      page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, color: gold, thickness: 0.35 });
      text(dateText(row.date), M + 5, 6.5); text(`${clean(row.category)} / ${clean(row.description)}`, M + 76, 6.5); text(party, M + 292, 6.5); text(money(row.amountPaise), M + 435, 6.5, regular, maroon);
      y -= 18;
    };

    newPage();
    text(`Period: ${from || 'Year start'} to ${to || 'Today'}`, M, 9, regular, maroon); y -= 16;
    text(`Total Income: ${money(incomeTotal)}   Total Expense: ${money(expenseTotal)}   Balance: ${money(incomeTotal - expenseTotal)}`, M, 9, bold, maroon); y -= 24;
    header('Income Register');
    tableHeader();
    for (const row of income) tableRow(row, row.receivedFrom);
    y -= 8;
    header('Expense Register');
    tableHeader();
    for (const row of expenses) tableRow(row, row.paidTo);
    ensure(92);
    header('Report Summary');
    text(`Income total: ${money(incomeTotal)}`, M + 8, 9); y -= 16;
    text(`Expense total: ${money(expenseTotal)}`, M + 8, 9); y -= 16;
    text(`Closing balance: ${money(incomeTotal - expenseTotal)}`, M + 8, 9, bold, maroon); y -= 26;
    text('Authorized Signatory: ________________________________', M + 8, 9, regular, maroon);
    const bytes = await pdf.save();
    return new NextResponse(bytes as unknown as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="society-financial-report.pdf"', 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Unable to generate report PDF.' }, { status });
  }
}
