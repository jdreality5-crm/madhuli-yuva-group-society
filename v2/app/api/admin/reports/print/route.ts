import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { requireSubAdminPermission } from '@/lib/session';

const W = 595;
const H = 842;
const M = 38;
const ink = rgb(0.14, 0.12, 0.11);
const maroon = rgb(0.35, 0.04, 0.04);
const gold = rgb(0.72, 0.58, 0.30);
const clean = (value: unknown) => String(value ?? '-').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() || '-';
const money = (value: unknown) => `Rs. ${(Number(value || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateText = (value: unknown) => { const date = new Date(String(value || '')); return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN'); };

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
      rest<any[]>('Income', { ...base, select: 'date,category,description,receivedFrom,amountPaise,paymentMethod' }),
      rest<any[]>('Expense', { ...base, select: 'date,category,description,paidTo,amountPaise,paymentMethod' }),
    ]);
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page = pdf.addPage([W, H]);
    let y = 790;
    const text = (value: unknown, x: number, size = 8, font = regular, color = ink) => { page.drawText(clean(value).slice(0, 105), { x, y, size, font, color }); y -= size + 5; };
    page.drawText('Society Financial Report', { x: M, y, size: 16, font: bold, color: maroon }); y -= 25;
    text(`Period: ${from || 'Year start'} to ${to || 'Today'}`, M, 9, regular, maroon); y -= 10;
    const incomeTotal = income.reduce((sum, row) => sum + Number(row.amountPaise || 0), 0);
    const expenseTotal = expenses.reduce((sum, row) => sum + Number(row.amountPaise || 0), 0);
    text(`Total Income: ${money(incomeTotal)}   Total Expense: ${money(expenseTotal)}   Balance: ${money(incomeTotal - expenseTotal)}`, M, 9, bold, maroon); y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, color: gold, thickness: 1 }); y -= 18;
    text('Income Register', M, 11, bold, maroon);
    for (const row of income) { if (y < 55) break; text(`${dateText(row.date)} | ${clean(row.category)} | ${clean(row.description)} | ${clean(row.receivedFrom)} | ${money(row.amountPaise)}`, M, 7); }
    y -= 10; text('Expense Register', M, 11, bold, maroon);
    for (const row of expenses) { if (y < 55) break; text(`${dateText(row.date)} | ${clean(row.category)} | ${clean(row.description)} | ${clean(row.paidTo)} | ${money(row.amountPaise)}`, M, 7); }
    const bytes = await pdf.save();
    return new NextResponse(bytes as unknown as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="society-financial-report.pdf"', 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Unable to generate report PDF.' }, { status });
  }
}
