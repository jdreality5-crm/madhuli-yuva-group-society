import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { requireSubAdminPermission } from '@/lib/session';
import { loadLetterhead } from '@/lib/payment-receipt-safe';

const W = 595;
const H = 842;
const M = 38;
const CW = W - M * 2;
const MAROON = rgb(0.35, 0.04, 0.04);
const GOLD = rgb(0.72, 0.58, 0.30);
const INK = rgb(0.14, 0.12, 0.11);
const MUTED = rgb(0.42, 0.39, 0.36);
const IVORY = rgb(0.985, 0.97, 0.93);
type Row = Record<string, any>;
type ReportData = { societyName: string; signatory: string; footer: string; title: string; period: string; income: Row[]; expenses: Row[]; letterhead: PDFImage | null };
type Column = { label: string; width: number };

async function rest<T>(table: string, query: Record<string, string>): Promise<T> {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`REST_${response.status}`);
  return data as T;
}

const clean = (value: unknown, fallback = '-') => { const text = String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(); return text || fallback; };
const ascii = (value: unknown) => clean(value).replace(/[^\x20-\x7E]/g, '');
const dateText = (value: unknown) => { const date = new Date(String(value || '')); return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN'); };
const money = (value: unknown) => `Rs. ${(Number(value || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const validDate = (value: string | null) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
const matchesProgram = (row: Row, eventId: string, title: string) => row.eventId === eventId || [row.category, row.description, row.referenceNumber, row.billNumber].some((value) => String(value || '').toLowerCase().includes(title.toLowerCase()));

function draw(page: PDFPage, value: unknown, x: number, y: number, font: PDFFont, size: number, color = INK, maxWidth?: number) {
  let rendered = ascii(value);
  if (maxWidth) while (rendered.length > 3 && font.widthOfTextAtSize(rendered, size) > maxWidth) rendered = rendered.slice(0, -1);
  page.drawText(rendered, { x, y, font, size, color });
}
function rule(page: PDFPage, y: number, color = GOLD, thickness = 1) { page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, color, thickness }); }
function placeLetterhead(page: PDFPage, image: PDFImage | null) { if (!image) return; const scale = Math.min(W / image.width, H / image.height); const width = image.width * scale; const height = image.height * scale; page.drawImage(image, { x: (W - width) / 2, y: (H - height) / 2, width, height }); }
function header(page: PDFPage, data: ReportData, regular: PDFFont, bold: PDFFont, number: number) {
  placeLetterhead(page, data.letterhead);
  rule(page, H - 36, MAROON, 3);
  draw(page, 'MADHULI YUVA GROUP SOCIETY', M, H - 56, bold, 8, GOLD, CW);
  draw(page, data.title, M, H - 82, bold, 17, MAROON, CW);
  draw(page, `${data.societyName} | Period: ${data.period}`, M, H - 99, regular, 7.5, MUTED, CW);
  rule(page, H - 111, GOLD, 0.8);
  draw(page, `Page ${number}`, W - M - 35, 22, regular, 7, MUTED, 35);
  if (data.footer) draw(page, data.footer, M, 22, regular, 7, MUTED, CW - 45);
}
function section(page: PDFPage, title: string, y: number, bold: PDFFont) { draw(page, title, M, y, bold, 10, MAROON, CW); rule(page, y - 7, GOLD, 0.65); return y - 22; }
function tableHead(page: PDFPage, columns: Column[], y: number, bold: PDFFont) { page.drawRectangle({ x: M, y: y - 4, width: CW, height: 17, color: MAROON }); let x = M; columns.forEach((column) => { draw(page, column.label, x + 4, y + 1, bold, 6.1, rgb(1, 1, 1), column.width - 8); x += column.width; }); return y - 19; }
function row(page: PDFPage, values: unknown[], columns: Column[], y: number, regular: PDFFont, bold: PDFFont, alternate: boolean) { if (alternate) page.drawRectangle({ x: M, y: y - 4, width: CW, height: 17, color: rgb(0.985, 0.975, 0.955) }); let x = M; values.forEach((value, index) => { const column = columns[index]; draw(page, value, x + 4, y + 1, index === values.length - 1 ? bold : regular, 6.1, INK, column.width - 8); x += column.width; }); page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, color: rgb(0.88, 0.84, 0.78), thickness: 0.35 }); return y - 17; }
function totals(rows: Row[]) { const map = new Map<string, number>(); rows.forEach((item) => { const key = ascii(item.category || 'Other'); map.set(key, (map.get(key) || 0) + Number(item.amountPaise || 0)); }); return [...map.entries()].sort((a, b) => b[1] - a[1]); }
function newPage(pdf: PDFDocument, data: ReportData, regular: PDFFont, bold: PDFFont, number: number) { const page = pdf.addPage([W, H]); header(page, data, regular, bold, number); return { page, y: H - 135 }; }

async function buildPdf(data: ReportData, requestUrl: string) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  data.letterhead = await loadLetterhead(pdf, requestUrl);
  let number = 1;
  let page = pdf.addPage([W, H]);
  header(page, data, regular, bold, number);
  let y = H - 135;
  const incomeTotal = data.income.reduce((sum, item) => sum + Number(item.amountPaise || 0), 0);
  const expenseTotal = data.expenses.reduce((sum, item) => sum + Number(item.amountPaise || 0), 0);
  const cardWidth = (CW - 16) / 3;
  [['Total Income', incomeTotal], ['Total Expense', expenseTotal], ['Balance', incomeTotal - expenseTotal]].forEach(([label, value], index) => { const x = M + index * (cardWidth + 8); page.drawRectangle({ x, y: y - 48, width: cardWidth, height: 48, color: IVORY, borderColor: GOLD, borderWidth: 0.7 }); draw(page, label, x + 9, y - 17, regular, 6.5, MUTED, cardWidth - 18); draw(page, money(value), x + 9, y - 35, bold, 12, MAROON, cardWidth - 18); });
  y -= 78;
  y = section(page, 'Program / Category Summary', y, bold);
  const summaryColumns = [{ label: 'Type', width: 85 }, { label: 'Category', width: 270 }, { label: 'Amount', width: 160 }];
  y = tableHead(page, summaryColumns, y, bold);
  const summaryRows = [...totals(data.income).map(([key, value]) => ['Income', key, money(value)]), ...totals(data.expenses).map(([key, value]) => ['Expense', key, money(value)])];
  if (!summaryRows.length) summaryRows.push(['-', 'No records found', money(0)]);
  summaryRows.forEach((values, index) => { if (y < 60) { number += 1; ({ page, y } = newPage(pdf, data, regular, bold, number)); y = tableHead(page, summaryColumns, y, bold); } y = row(page, values, summaryColumns, y, regular, bold, index % 2 === 1); });
  const incomeColumns = [{ label: 'Date', width: 48 }, { label: 'Program', width: 70 }, { label: 'Category', width: 72 }, { label: 'Description', width: 116 }, { label: 'Received From', width: 92 }, { label: 'Method', width: 55 }, { label: 'Amount', width: 62 }];
  y -= 13; y = section(page, 'Income Register', y, bold); y = tableHead(page, incomeColumns, y, bold);
  if (!data.income.length) y = row(page, ['-', '-', '-', 'No income records found', '-', '-', money(0)], incomeColumns, y, regular, bold, false);
  data.income.forEach((item, index) => { if (y < 60) { number += 1; ({ page, y } = newPage(pdf, data, regular, bold, number)); y = section(page, 'Income Register (continued)', y, bold); y = tableHead(page, incomeColumns, y, bold); } y = row(page, [dateText(item.date), item.programName, item.category, item.description, item.receivedFrom, item.paymentMethod, money(item.amountPaise)], incomeColumns, y, regular, bold, index % 2 === 1); });
  const expenseColumns = [{ label: 'Date', width: 48 }, { label: 'Program', width: 70 }, { label: 'Category', width: 72 }, { label: 'Description', width: 116 }, { label: 'Paid To', width: 92 }, { label: 'Method', width: 55 }, { label: 'Amount', width: 62 }];
  y -= 13; if (y < 125) { number += 1; ({ page, y } = newPage(pdf, data, regular, bold, number)); } y = section(page, 'Expense Register', y, bold); y = tableHead(page, expenseColumns, y, bold);
  if (!data.expenses.length) y = row(page, ['-', '-', '-', 'No expense records found', '-', '-', money(0)], expenseColumns, y, regular, bold, false);
  data.expenses.forEach((item, index) => { if (y < 60) { number += 1; ({ page, y } = newPage(pdf, data, regular, bold, number)); y = section(page, 'Expense Register (continued)', y, bold); y = tableHead(page, expenseColumns, y, bold); } y = row(page, [dateText(item.date), item.programName, item.category, item.description, item.paidTo, item.paymentMethod, money(item.amountPaise)], expenseColumns, y, regular, bold, index % 2 === 1); });
  y -= 18; if (y < 80) { number += 1; ({ page, y } = newPage(pdf, data, regular, bold, number)); } rule(page, y, GOLD, 0.8); draw(page, `Authorized Signatory: ${data.signatory}`, M, y - 18, regular, 8, MUTED, CW); draw(page, 'Generated electronically from society records', M, y - 32, regular, 7, MUTED, CW);
  return pdf.save();
}

export async function GET(req: Request) {
  try {
    const session = await requireSubAdminPermission('REPORTS');
    const params = new URL(req.url).searchParams;
    const from = params.get('from'); const to = params.get('to'); const eventId = params.get('eventId')?.trim() || '';
    if (!validDate(from) || !validDate(to)) return NextResponse.json({ error: 'Invalid report date. Use YYYY-MM-DD.' }, { status: 400 });
    if (from && to && from > to) return NextResponse.json({ error: 'Report start date cannot be after the end date.' }, { status: 400 });
    const start = from ? new Date(`${from}T00:00:00.000Z`).toISOString() : new Date(new Date().getFullYear(), 0, 1).toISOString();
    const end = to ? new Date(`${to}T23:59:59.999Z`).toISOString() : new Date().toISOString();
    const base = { societyId: `eq.${session.societyId}`, and: `(date.gte.${start},date.lte.${end})`, order: 'date.desc' };
    const [incomeRows, expenseRows, societies, events] = await Promise.all([
      rest<Row[]>('Income', { ...base, select: 'id,date,category,description,receivedFrom,amountPaise,paymentMethod,eventId,referenceNumber' }),
      rest<Row[]>('Expense', { ...base, select: 'id,date,category,description,paidTo,amountPaise,paymentMethod,eventId,billNumber' }),
      rest<Row[]>('Society', { select: 'name,authorizedSignatory,reportFooter', id: `eq.${session.societyId}`, limit: '1' }),
      rest<Row[]>('Event', { select: 'id,title,gujaratiTitle', societyId: `eq.${session.societyId}`, limit: '500' }),
    ]);
    const selected = eventId ? events.find((event) => event.id === eventId) : null;
    const selectedTitle = String(selected?.title || selected?.gujaratiTitle || '');
    const income = (eventId ? incomeRows.filter((row) => matchesProgram(row, eventId, selectedTitle)) : incomeRows).map((item) => ({ ...item, programName: events.find((event) => event.id === item.eventId)?.title || (selected && matchesProgram(item, eventId, selectedTitle) ? selectedTitle : 'Unassigned') }));
    const expenses = (eventId ? expenseRows.filter((row) => matchesProgram(row, eventId, selectedTitle)) : expenseRows).map((item) => ({ ...item, programName: events.find((event) => event.id === item.eventId)?.title || (selected && matchesProgram(item, eventId, selectedTitle) ? selectedTitle : 'Unassigned') }));
    const society = societies[0] || {};
    const data: ReportData = { societyName: ascii(society.name || 'Society'), signatory: ascii(society.authorizedSignatory || '-'), footer: ascii(society.reportFooter || ''), title: selected ? `Program Financial Report - ${ascii(selected.title || selected.gujaratiTitle)}` : 'Society Financial Report', period: `${from || 'Year start'} to ${to || 'Today'}`, income, expenses, letterhead: null };
    const bytes = await buildPdf(data, req.url);
    const filename = `society-financial-report-${from || 'start'}-to-${to || 'today'}${selected ? `-${ascii(selected.title).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}` : ''}.pdf`;
    return new NextResponse(bytes as unknown as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Unable to generate PDF report.' }, { status });
  }
}
