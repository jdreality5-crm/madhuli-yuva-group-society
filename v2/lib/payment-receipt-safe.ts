import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

type ReceiptContext = { payment: any; owner: any; society: any; event: any; account: any; bill: any };
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MAROON = rgb(0.35, 0.04, 0.04);
const DARK = rgb(0.13, 0.12, 0.11);
const MUTED = rgb(0.38, 0.36, 0.33);

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
  const response = await fetch(url, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json', Prefer: 'return=representation' } : {}), ...(init?.headers || {}) }, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`REST_${response.status}`);
  return data as T;
}

function storagePath(path: string) { return path.split('/').map((part) => encodeURIComponent(part)).join('/'); }

async function storageUpload(path: string, bytes: Uint8Array) {
  const { base, key, bucket } = config();
  const response = await fetch(`${base}/storage/v1/object/${encodeURIComponent(bucket)}/${storagePath(path)}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/pdf', 'x-upsert': 'true' }, body: bytes as unknown as BodyInit, cache: 'no-store' });
  if (!response.ok) throw new Error(`STORAGE_UPLOAD_${response.status}`);
}

export async function signReceipt(path: string | null | undefined) {
  if (!path) return null;
  const { base, key, bucket } = config();
  const response = await fetch(`${base}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${storagePath(path)}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }), cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`STORAGE_SIGN_${response.status}`);
  const signed = data?.signedURL || data?.signedUrl;
  if (!signed) return null;
  const value = String(signed);
  return value.startsWith('http') ? value : `${base}/storage/v1${value.startsWith('/') ? value : `/${value}`}`;
}

async function loadContext(paymentId: string, societyId: string): Promise<ReceiptContext | null> {
  const payments = await rest<any[]>('Payment', { select: '*', id: `eq.${paymentId}`, societyId: `eq.${societyId}`, status: 'eq.VERIFIED', limit: '1' });
  const payment = payments[0];
  if (!payment) return null;
  const [owners, societies, events, accounts, bills] = await Promise.all([
    rest<any[]>('User', { select: 'id,name,email,mobile,flatId,unitId', id: `eq.${payment.ownerUserId}`, limit: '1' }),
    rest<any[]>('Society', { select: 'id,authorizedSignatory,reportFooter', id: `eq.${societyId}`, limit: '1' }),
    payment.eventId ? rest<any[]>('Event', { select: 'id,title,gujaratiTitle,date', id: `eq.${payment.eventId}`, limit: '1' }) : [],
    rest<any[]>('PaymentAccount', { select: 'id,displayName,purpose', id: `eq.${payment.paymentAccountId}`, limit: '1' }),
    payment.billId ? rest<any[]>('Bill', { select: 'id,type,category,date,paymentMethod', id: `eq.${payment.billId}`, limit: '1' }) : [],
  ]);
  return { payment, owner: owners[0] || null, society: societies[0] || null, event: events[0] || null, account: accounts[0] || null, bill: bills[0] || null };
}

function clean(value: unknown, fallback = '-') { const text = String(value ?? '').trim(); return text || fallback; }
function money(value: unknown) { return `Rs. ${(Number(value || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function dateText(value: unknown) { if (!value) return '-'; return new Date(String(value)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function receiptNumber(paymentId: string, verifiedAt: unknown) { const year = verifiedAt ? new Date(String(verifiedAt)).getFullYear() : new Date().getFullYear(); return `MYGM-${year}-${paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`; }
function formatPaymentMethod(value: unknown) { return String(value ?? '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function paymentMethod(context: ReceiptContext) {
  const candidates = [context.payment?.paymentMethod, context.payment?.method, context.payment?.payment_mode, context.payment?.mode, context.payment?.channel, context.bill?.paymentMethod, context.bill?.method];
  return candidates.map(formatPaymentMethod).find(Boolean) || '—';
}

function drawWrapped(page: PDFPage, text: string, x: number, y: number, width: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>) {
  const words = text.split(/\s+/).filter(Boolean); let line = ''; let cursor = y;
  for (const word of words) { const next = line ? `${line} ${word}` : word; if (font.widthOfTextAtSize(next, size) > width && line) { page.drawText(line, { x, y: cursor, size, font, color }); cursor -= size + 3; line = word; } else line = next; }
  if (line) page.drawText(line, { x, y: cursor, size, font, color }); return cursor;
}

function drawData(page: PDFPage, label: string, value: unknown, y: number, regular: PDFFont, bold: PDFFont) {
  page.drawText(label, { x: 76, y, size: 10, font: bold, color: MAROON });
  drawWrapped(page, clean(value), 235, y, 280, regular, 10, DARK);
}

function isPng(bytes: Uint8Array) {
  return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
}

async function loadLetterhead(pdf: PDFDocument, requestUrl: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const candidates = [
    configuredOrigin ? new URL('/letterhead,A4.jpg', configuredOrigin).toString() : null,
    new URL('/letterhead,A4.jpg', requestUrl).toString(),
    'https://raw.githubusercontent.com/jdreality5-crm/madhuli-yuva-group-society/fresh-society-v2/v2/public/letterhead,A4.jpg',
    configuredOrigin ? new URL('/letterhead.jpg', configuredOrigin).toString() : null,
    new URL('/letterhead.jpg', requestUrl).toString(),
  ].filter((value): value is string => Boolean(value));

  for (const assetUrl of candidates) {
    try {
      const response = await fetch(assetUrl, { cache: 'no-store' });
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length) continue;
      return isPng(bytes) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    } catch {
      // Try the next known asset location.
    }
  }
  return null;
}

function drawAuthorizedSignature(page: PDFPage, context: ReceiptContext, bold: PDFFont) {
  const rawName = String(context.society?.authorizedSignatory ?? '').trim();
  const normalized = rawName.toLowerCase().replace(/[^a-z]/g, '');
  const genericLabels = new Set(['adminorganizer', 'admin', 'organizer', 'authorizedsignatory', 'authorisedsignatory']);
  if (rawName && !genericLabels.has(normalized)) {
    page.drawText(rawName, { x: 390, y: 245, size: 10, font: bold, color: MAROON });
  }
  page.drawText('Authorized Signatory', { x: 390, y: 231, size: 8.5, font: bold, color: MUTED });
}

async function buildPdf(context: ReceiptContext, number: string, requestUrl: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const letterhead = await loadLetterhead(pdf, requestUrl);
  if (letterhead) {
    const scale = Math.min(PAGE_WIDTH / letterhead.width, PAGE_HEIGHT / letterhead.height);
    const width = letterhead.width * scale;
    const height = letterhead.height * scale;
    page.drawImage(letterhead, { x: (PAGE_WIDTH - width) / 2, y: (PAGE_HEIGHT - height) / 2, width, height });
  }

  // Keep every field inside the original blank center area of the supplied A4 artwork.
  page.drawText(`Receipt No: ${number}`, { x: 76, y: 620, size: 9, font: regular, color: MUTED });
  page.drawText(`Date: ${dateText(context.payment.verifiedAt || context.payment.updatedAt)}`, { x: 405, y: 620, size: 9, font: regular, color: DARK });
  drawData(page, 'Received From', context.owner?.name || context.owner?.email, 575, regular, bold);
  drawData(page, 'Amount', money(context.payment.amountPaise), 535, regular, bold);
  drawData(page, 'Purpose', context.event?.title || context.account?.purpose || context.bill?.category || 'Other Payment', 495, regular, bold);
  drawData(page, 'Payment Account', context.account?.displayName, 455, regular, bold);
  drawData(page, 'Payment Method', paymentMethod(context), 415, regular, bold);
  drawData(page, 'Transaction ID / UTR', context.payment.transactionId, 375, regular, bold);
  drawData(page, 'Payment Status', 'VERIFIED', 335, regular, bold);
  drawAuthorizedSignature(page, context, bold);
  return pdf.save();
}

export async function generateAndStoreReceipt(input: { paymentId: string; societyId: string; requestUrl: string }) {
  const context = await loadContext(input.paymentId, input.societyId);
  if (!context) throw new Error('VERIFIED_PAYMENT_NOT_FOUND');
  const number = context.payment.receiptNumber || receiptNumber(context.payment.id, context.payment.verifiedAt);
  const bytes = await buildPdf(context, number, input.requestUrl);
  const path = `${input.societyId}/payment-receipts/${number}.pdf`;
  await storageUpload(path, bytes);
  await rest('Payment', { id: `eq.${input.paymentId}`, societyId: `eq.${input.societyId}`, status: 'eq.VERIFIED' }, { method: 'PATCH', body: JSON.stringify({ receiptNumber: number, receiptStoragePath: path, receiptGeneratedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }) });
  return { receiptNumber: number, receiptStoragePath: path, reused: false };
}
