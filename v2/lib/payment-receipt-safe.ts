import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { AUTHORIZED_LOGO_BLACK_PATHS } from './authorized-logo-black';

type ReceiptContext = {
  payment: any;
  owner: any;
  society: any;
  event: any;
  account: any;
  bill: any;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const COLORS = {
  maroon: rgb(0.35, 0.04, 0.04),
  dark: rgb(0.13, 0.12, 0.11),
  muted: rgb(0.38, 0.36, 0.33),
  gold: rgb(0.67, 0.46, 0.13),
  border: rgb(0.82, 0.77, 0.68),
  pale: rgb(0.98, 0.96, 0.92),
  green: rgb(0.08, 0.42, 0.20),
};

function config() {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'society-files';
  if (!base || !key) throw new Error('CONFIG');
  return { base, key, bucket };
}

async function rest<T>(table: string, query: Record<string, string>, init?: RequestInit): Promise<T> {
  const { base, key } = config();
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json', Prefer: 'return=representation' } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`REST_${response.status}`);
  return data as T;
}

function storagePath(path: string) {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/');
}

async function storageUpload(path: string, bytes: Uint8Array) {
  const { base, key, bucket } = config();
  const response = await fetch(`${base}/storage/v1/object/${encodeURIComponent(bucket)}/${storagePath(path)}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: bytes as unknown as BodyInit,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`STORAGE_UPLOAD_${response.status}`);
}

export async function signReceipt(path: string | null | undefined) {
  if (!path) return null;
  const { base, key, bucket } = config();
  const response = await fetch(`${base}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${storagePath(path)}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 3600 }),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`STORAGE_SIGN_${response.status}`);
  const signed = data?.signedURL || data?.signedUrl;
  if (!signed) return null;
  const value = String(signed);
  return value.startsWith('http') ? value : `${base}/storage/v1${value.startsWith('/') ? value : `/${value}`}`;
}

async function loadContext(paymentId: string, societyId: string): Promise<ReceiptContext | null> {
  const payments = await rest<any[]>('Payment', {
    select: '*',
    id: `eq.${paymentId}`,
    societyId: `eq.${societyId}`,
    status: 'eq.VERIFIED',
    limit: '1',
  });
  const payment = payments[0];
  if (!payment) return null;

  const [owners, societies, events, accounts, bills] = await Promise.all([
    rest<any[]>('User', {
      select: 'id,name,email,mobile,flatId,unitId',
      id: `eq.${payment.ownerUserId}`,
      limit: '1',
    }),
    rest<any[]>('Society', {
      select: 'id,name,address,city,state,pincode,authorizedSignatory,reportFooter,logoUrl,contact',
      id: `eq.${societyId}`,
      limit: '1',
    }),
    payment.eventId
      ? rest<any[]>('Event', {
          select: 'id,title,gujaratiTitle,date',
          id: `eq.${payment.eventId}`,
          limit: '1',
        })
      : [],
    rest<any[]>('PaymentAccount', {
      select: 'id,displayName,purpose',
      id: `eq.${payment.paymentAccountId}`,
      limit: '1',
    }),
    payment.billId
      ? rest<any[]>('Bill', {
          select: 'id,type,category,date,paymentMethod',
          id: `eq.${payment.billId}`,
          limit: '1',
        })
      : [],
  ]);

  return {
    payment,
    owner: owners[0] || null,
    society: societies[0] || null,
    event: events[0] || null,
    account: accounts[0] || null,
    bill: bills[0] || null,
  };
}

function money(value: unknown) {
  return `Rs. ${(Number(value || 0) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateText(value: unknown) {
  if (!value) return '-';
  return new Date(String(value)).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function receiptNumber(paymentId: string, verifiedAt: unknown) {
  const year = verifiedAt ? new Date(String(verifiedAt)).getFullYear() : new Date().getFullYear();
  return `MYGM-${year}-${paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
}

function clean(value: unknown, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function paymentMethod(context: ReceiptContext) {
  const method = context.payment?.paymentMethod || context.bill?.paymentMethod;
  if (!method) return 'Not recorded';
  return String(method).replace(/_/g, ' ');
}

function addressText(society: any) {
  return [society?.address, society?.city, society?.state, society?.pincode]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

function drawWrappedText(page: PDFPage, text: string, x: number, y: number, maxWidth: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>, lineGap = 4) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  let cursorY = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
      cursorY -= size + lineGap;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) page.drawText(line, { x, y: cursorY, size, font, color });
  return cursorY - size - lineGap;
}

function drawLogo(page: PDFPage, x: number, y: number) {
  for (const path of AUTHORIZED_LOGO_BLACK_PATHS) {
    page.drawSvgPath(path, { x, y, scale: 0.075, color: rgb(0, 0, 0) });
  }
}

function drawRow(page: PDFPage, label: string, value: string, y: number, regular: PDFFont, bold: PDFFont) {
  page.drawText(label, { x: 72, y, size: 10.5, font: bold, color: COLORS.maroon });
  drawWrappedText(page, clean(value), 235, y, 285, regular, 10.5, COLORS.dark, 3);
  page.drawLine({
    start: { x: 72, y: y - 9 },
    end: { x: 523, y: y - 9 },
    thickness: 0.45,
    color: COLORS.border,
  });
}

async function buildPdf(context: ReceiptContext, number: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: 760, width: PAGE_WIDTH, height: 82, color: COLORS.pale });
  page.drawRectangle({ x: 0, y: 756, width: PAGE_WIDTH, height: 4, color: COLORS.gold });
  drawLogo(page, 48, 705);

  const societyName = clean(context.society?.name, 'Society');
  page.drawText(societyName, { x: 145, y: 800, size: 18, font: bold, color: COLORS.maroon, maxWidth: 390 });
  const address = addressText(context.society);
  if (address) drawWrappedText(page, address, 145, 780, 390, regular, 9, COLORS.muted, 2);
  if (context.society?.contact) {
    page.drawText(`Contact: ${context.society.contact}`, { x: 145, y: 766, size: 8.5, font: regular, color: COLORS.muted });
  }

  page.drawText('PAYMENT RECEIPT', { x: 194, y: 710, size: 21, font: bold, color: COLORS.maroon });
  page.drawText(`Receipt No: ${number}`, { x: 72, y: 682, size: 9.5, font: regular, color: COLORS.dark });
  page.drawText(`Date: ${dateText(context.payment.verifiedAt || context.payment.updatedAt)}`, { x: 395, y: 682, size: 9.5, font: regular, color: COLORS.dark });

  drawRow(page, 'Received From', context.owner?.name || context.owner?.email, 640, regular, bold);
  drawRow(page, 'Amount', money(context.payment.amountPaise), 598, regular, bold);
  drawRow(page, 'Purpose', context.event?.title || context.account?.purpose || context.bill?.category || 'Other Payment', 556, regular, bold);
  drawRow(page, 'Payment Account', context.account?.displayName, 514, regular, bold);
  drawRow(page, 'Payment Method', paymentMethod(context), 472, regular, bold);
  drawRow(page, 'Transaction ID / UTR', context.payment.transactionId, 430, regular, bold);
  drawRow(page, 'Payment Status', 'VERIFIED', 388, regular, bold);

  page.drawRectangle({ x: 72, y: 270, width: 451, height: 70, color: COLORS.pale, borderColor: COLORS.border, borderWidth: 0.6 });
  page.drawText('Payment confirmation', { x: 88, y: 318, size: 10.5, font: bold, color: COLORS.maroon });
  drawWrappedText(page, 'This receipt confirms that the payment listed above was verified by the society system.', 88, 299, 415, regular, 9.5, COLORS.dark, 3);
  page.drawText('VERIFIED', { x: 88, y: 279, size: 9.5, font: bold, color: COLORS.green });

  page.drawLine({ start: { x: 350, y: 180 }, end: { x: 523, y: 180 }, thickness: 0.8, color: COLORS.gold });
  page.drawText(clean(context.society?.authorizedSignatory, 'Authorized Signatory'), { x: 350, y: 162, size: 10, font: bold, color: COLORS.maroon, maxWidth: 173 });
  page.drawText('Authorized Signatory', { x: 350, y: 146, size: 9, font: regular, color: COLORS.muted });

  const footer = clean(context.society?.reportFooter, 'Thank you for your payment.');
  drawWrappedText(page, footer, 72, 90, 451, regular, 8.5, COLORS.muted, 2);
  page.drawText('Generated electronically • No physical signature required', { x: 72, y: 55, size: 8, font: regular, color: COLORS.muted });

  return pdf.save();
}

export async function generateAndStoreReceipt(input: { paymentId: string; societyId: string; requestUrl: string }) {
  const context = await loadContext(input.paymentId, input.societyId);
  if (!context) throw new Error('VERIFIED_PAYMENT_NOT_FOUND');

  const number = context.payment.receiptNumber || receiptNumber(context.payment.id, context.payment.verifiedAt);
  const bytes = await buildPdf(context, number);
  const path = `${input.societyId}/payment-receipts/${number}.pdf`;
  await storageUpload(path, bytes);
  await rest('Payment', { id: `eq.${input.paymentId}`, societyId: `eq.${input.societyId}`, status: 'eq.VERIFIED' }, {
    method: 'PATCH',
    body: JSON.stringify({
      receiptNumber: number,
      receiptStoragePath: path,
      receiptGeneratedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  });
  return { receiptNumber: number, receiptStoragePath: path, reused: false };
}
