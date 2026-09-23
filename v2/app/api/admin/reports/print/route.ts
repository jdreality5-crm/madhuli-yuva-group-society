import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { requireSubAdminPermission } from '@/lib/session';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 38;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const MAROON = rgb(0.35, 0.04, 0.04);
const GOLD = rgb(0.72, 0.58, 0.30);
const INK = rgb(0.14, 0.12, 0.11);
const MUTED = rgb(0.42, 0.39, 0.36);
const IVORY = rgb(0.985, 0.97, 0.93);

type Row = Record<string, any>;

type ReportData = {
  societyName: string;
  authorizedSignatory: string;
  reportFooter: string;
  title: string;
  period: string;
  income: Row[];
  expenses: Row[];
  events: Row[];
};

async function rest<T>(table: string, query: Record<string, string>): Promise<T> {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`REST_${response.status}`);
  return data as T;
}

function validDate(value: string | null) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function clean(value: unknown, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function escText(value: unknown) {
  return clean(value).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function money(value: unknown) {
  return `Rs. ${(Number(value || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateText(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN');
}

function fitText(value: unknown, font: PDFFont, size: number, maxWidth: number) {
  const text = escText(value);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let output = text;
  while (output.length > 3 && font.widthOfTextAtSize(`${output}…`, size) > maxWidth) output = output.slice(0, -1);
  return `${output.trim()}…`;
}

function text(page: PDFPage, value: unknown, x: number, y: number, font: PDFFont, size: number, color = INK, maxWidth?: number) {
  const rendered = maxWidth ? fitText(value, font, size, maxWidth) : escText(value);
  page.drawText(rendered, { x, y, font, size, color });
}

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number, color = GOLD, thickness = 1) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness });
}

function header(page: PDFPage, data: ReportData, bold: PDFFont, regular: PDFFont, pageNumber: number) {
  line(page, MARGIN, PAGE_HEIGHT - 36, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 36, MAROON, 3);
  text(page, 'MADHULI YUVA GROUP SOCIETY', MARGIN, PAGE_HEIGHT - 56, bold, 8, GOLD, CONTENT_WIDTH);
  text(page, data.title, MARGIN, PAGE_HEIGHT - 82, bold, 17, MAROON, CONTENT_WIDTH);
  text(page, `${data.societyName}  ·  Period: ${data.period}`, MARGIN, PAGE_HEIGHT - 99, regular, 7.5, MUTED, CONTENT_WIDTH);
  line(page, MARGIN, PAGE_HEIGHT - 111, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 111, GOLD, 0.8);
  text(page, `Page ${pageNumber}`, PAGE_WIDTH - MARGIN - 35, 22, regular, 7, MUTED, 35);
  if (data.reportFooter) text(page, data.reportFooter, MARGIN, 22, regular, 7, MUTED, CONTENT_WIDTH - 45);
}

function summaryCard(page: PDFPage, label: string, value: string, x: number, y: number, width: number, bold: PDFFont, regular: PDFFont) {
  page.drawRectangle({ x, y, width, height: 48, color: IVORY, borderColor: GOLD, borderWidth: 0.7 });
  text(page, label.toUpperCase(), x + 9, y + 31, regular, 6.5, MUTED, width - 18);
  text(page, value, x + 9, y + 13, bold, 12, MAROON, width - 18);
}

function tableHeader(page: PDFPage, columns: Array<{ label: string; width: number }>, y: number, bold: PDFFont) {
  let x = MARGIN;
  page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_WIDTH, height: 17, color: MAROON });
  for (const column of columns) {
    text(page, column.label, x + 4, y + 1, bold, 6.3, rgb(1, 1, 1), column.width - 8);
    x += column.width;
  }
  return y - 19;
}

function tableRow(page: PDFPage, values: unknown[], columns: Array<{ label: string; width: number }>, y: number, regular: PDFFont, bold: PDFFont, alternate: boolean) {
  const rowHeight = 17;
  if (alternate) page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_WIDTH, height: rowHeight, color: rgb(0.985, 0.975, 0.955) });
  let x = MARGIN;
  values.forEach((value, index) => {
    const column = columns[index];
    const isAmount = index === values.length - 1;
    text(page, value, isAmount ? x + 3 : x + 4, y + 1, isAmount ? bold : regular, 6.2, INK, column.width - 8);
    x += column.width;
  });
  line(page, MARGIN, y - 4, PAGE_WIDTH - MARGIN, y - 4, rgb(0.88, 0.84, 0.78), 0.35);
  return y - rowHeight;
}

function categoryTotals(rows: Row[]) {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const key = clean(row.category, 'Other');
    totals.set(key, (totals.get(key) || 0) + Number(row.amountPaise || 0));
  });
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function addSectionTitle(page: PDFPage, title: string, y: number, bold: PDFFont) {
  text(page, title, MARGIN, y, bold, 10, MAROON, CONTENT_WIDTH);
  line(page, MARGIN, y - 7, PAGE_WIDTH - MARGIN, y - 7, GOLD, 0.65);
  return y - 22;
}

function newPage(pdf: PDFDocument, data: ReportData, bold: PDFFont, regular: PDFFont, pageNumber: number) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  header(page, data, bold, regular, pageNumber);
  return PAGE_HEIGHT - 135;
}

async function buildPdf(data: ReportData) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let pageNumber = 1;
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  header(page, data, bold, regular, pageNumber);
  let y = PAGE_HEIGHT - 135;

  const totalIncome = data.income.reduce((sum, row) => sum + Number(row.amountPaise || 0), 0);
  const totalExpense = data.expenses.reduce((sum, row) => sum + Number(row.amountPaise || 0), 0);
  const cardWidth = (CONTENT_WIDTH - 16) / 3;
  summaryCard(page, 'Total Income', money(totalIncome), MARGIN, y - 48, cardWidth, bold, regular);
  summaryCard(page, 'Total Expense', money(totalExpense), MARGIN + cardWidth + 8, y - 48, cardWidth, bold, regular);
  summaryCard(page, 'Balance', money(totalIncome - totalExpense), MARGIN + (cardWidth + 8) * 2, y - 48, cardWidth, bold, regular);
  y -= 78;

  y = addSectionTitle(page, 'Program / Category Summary', y, bold);
  const summaryColumns = [{ label: 'Type', width: 85 }, { label: 'Category', width: 270 }, { label: 'Amount', width: 160 }];
  y = tableHeader(page, summaryColumns, y, bold);
  const summaries = [
    ...categoryTotals(data.income).map(([category, amount]) => ['Income', category, money(amount)]),
    ...categoryTotals(data.expenses).map(([category, amount]) => ['Expense', category, money(amount)]),
  ];
  if (!summaries.length) summaries.push(['—', 'No records found', money(0)]);
  summaries.forEach((row, index) => {
    if (y < 60) { pageNumber += 1; page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]); header(page, data, bold, regular, pageNumber); y = PAGE_HEIGHT - 135; y = tableHeader(page, summaryColumns, y, bold); }
    y = tableRow(page, row, summaryColumns, y, regular, bold, index % 2 === 1);
  });

  const incomeColumns = [
    { label: 'Date', width: 48 }, { label: 'Program', width: 70 }, { label: 'Category', width: 72 },
    { label: 'Description', width: 116 }, { label: 'Received From', width: 92 }, { label: 'Method', width: 55 }, { label: 'Amount', width: 62 },
  ];
  y -= 13;
  y = addSectionTitle(page, 'Income Register / આવક', y, bold);
  y = tableHeader(page, incomeColumns, y, bold);
  if (!data.income.length) y = tableRow(page, ['—', '—', '—', 'No income records found', '—', '—', money(0)], incomeColumns, y, regular, bold, false);
  data.income.forEach((row, index) => {
    if (y < 60) { pageNumber += 1; page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]); header(page, data, bold, regular, pageNumber); y = PAGE_HEIGHT - 135; y = addSectionTitle(page, 'Income Register / આવક (continued)', y, bold); y = tableHeader(page, incomeColumns, y, bold); }
    y = tableRow(page, [dateText(row.date), row.programName, row.category, row.description, row.receivedFrom, row.paymentMethod, money(row.amountPaise)], incomeColumns, y, regular, bold, index % 2 === 1);
  });

  const expenseColumns = [
    { label: 'Date', width: 48 }, { label: 'Program', width: 70 }, { label: 'Category', width: 72 },
    { label: 'Description', width: 116 }, { label: 'Paid To', width: 92 }, { label: 'Method', width: 55 }, { label: 'Amount', width: 62 },
  ];
  y -= 13;
  if (y < 125) { pageNumber += 1; page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]); header(page, data, bold, regular, pageNumber); y = PAGE_HEIGHT - 135; }
  y = addSectionTitle(page, 'Expense Register / ખર્ચ', y, bold);
  y = tableHeader(page, expenseColumns, y, bold);
  if (!data.expenses.length) y = tableRow(page, ['—', '—', '—', 'No expense records found', '—', '—', money(0)], expenseColumns, y, regular, bold, false);
  data.expenses.forEach((row, index) => {
    if (y < 60) { pageNumber += 1; page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]); header(page, data, bold, regular, pageNumber); y = PAGE_HEIGHT - 135; y = addSectionTitle(page, 'Expense Register / ખર્ચ (continued)', y, bold); y = tableHeader(page, expenseColumns, y, bold); }
    y = tableRow(page, [dateText(row.date), row.programName, row.category, row.description, row.paidTo, row.paymentMethod, money(row.amountPaise)], expenseColumns, y, regular, bold, index % 2 === 1);
  });

  y -= 18;
  if (y < 80) { pageNumber += 1; page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]); header(page, data, bold, regular, pageNumber); y = PAGE_HEIGHT - 135; }
  line(page, MARGIN, y, PAGE_WIDTH - MARGIN, y, GOLD, 0.8);
  text(page, `Authorized Signatory: ${data.authorizedSignatory || '—'}`, MARGIN, y - 18, regular, 8, MUTED, CONTENT_WIDTH);
  text(page, 'Generated electronically from society records', MARGIN, y - 32, regular, 7, MUTED, CONTENT_WIDTH);
  return pdf.save();
}

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
    const base = { societyId: `eq.${session.societyId}`, and: `(date.gte.${start},date.lte.${end})`, order: 'date.desc' };
    const incomeQuery = eventId ? { ...base, eventId: `eq.${eventId}` } : base;
    const expenseQuery = eventId ? { ...base, eventId: `eq.${eventId}` } : base;

    const [incomeRows, expenseRows, societies, events] = await Promise.all([
      rest<Row[]>('Income', { ...incomeQuery, select: 'id,date,category,description,receivedFrom,amountPaise,paymentMethod,eventId' }),
      rest<Row[]>('Expense', { ...expenseQuery, select: 'id,date,category,description,paidTo,amountPaise,paymentMethod,eventId' }),
      rest<Row[]>('Society', { select: 'name,authorizedSignatory,reportFooter', id: `eq.${session.societyId}`, limit: '1' }),
      rest<Row[]>('Event', { select: 'id,title,gujaratiTitle', societyId: `eq.${session.societyId}`, limit: '500' }),
    ]);

    const eventMap = new Map(events.map((event) => [event.id, event.gujaratiTitle || event.title]));
    const income = incomeRows.map((row) => ({ ...row, programName: eventMap.get(row.eventId) || 'General' }));
    const expenses = expenseRows.map((row) => ({ ...row, programName: eventMap.get(row.eventId) || 'General' }));
    const selectedEvent = eventId ? events.find((event) => event.id === eventId) : null;
    const society = societies[0] || {};
    const title = selectedEvent ? `Program Financial Report · ${selectedEvent.gujaratiTitle || selectedEvent.title}` : 'Society Financial Report';
    const data: ReportData = {
      societyName: society.name || 'Society',
      authorizedSignatory: society.authorizedSignatory || '',
      reportFooter: society.reportFooter || '',
      title,
      period: `${from || 'Year start'} to ${to || 'Today'}`,
      income,
      expenses,
      events,
    };
    const bytes = await buildPdf(data);
    const safeName = (selectedEvent?.title || 'society-financial-report').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'society-financial-report';
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}-${from || 'start'}-to-${to || 'today'}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Unable to generate PDF report.' }, { status });
  }
}
