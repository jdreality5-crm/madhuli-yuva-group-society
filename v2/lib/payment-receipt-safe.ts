import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { AUTHORIZED_LOGO_BLACK_PATHS } from './authorized-logo-black';

type ReceiptContext = { payment: any; owner: any; society: any; event: any; account: any; bill: any };

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
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
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
  const payments = await rest<any[]>('Payment', { select: '*', id: `eq.${paymentId}`, societyId: `eq.${societyId}`, status: 'eq.VERIFIED', limit: '1' });
  const payment = payments[0];
  if (!payment) return null;
  const [owners, societies, events, accounts, bills] = await Promise.all([
    rest<any[]>('User', { select: 'id,name,email,mobile,flatId,unitId', id: `eq.${payment.ownerUserId}`, limit: '1' }),
    rest<any[]>('Society', { select: 'id,name,address,city,state,pincode,authorizedSignatory,reportFooter', id: `eq.${societyId}`, limit: '1' }),
    payment.eventId ? rest<any[]>('Event', { select: 'id,title,gujaratiTitle,date', id: `eq.${payment.eventId}`, limit: '1' }) : [],
    rest<any[]>('PaymentAccount', { select: 'id,displayName,purpose', id: `eq.${payment.paymentAccountId}`, limit: '1' }),
    payment.billId ? rest<any[]>('Bill', { select: 'id,type,category,date', id: `eq.${payment.billId}`, limit: '1' }) : [],
  ]);
  return { payment, owner: owners[0] || null, society: societies[0] || null, event: events[0] || null, account: accounts[0] || null, bill: bills[0] || null };
}

function money(value: unknown) {
  return `Rs. ${(Number(value || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateText(value: unknown) {
  if (!value) return '-';
  return new Date(String(value)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function receiptNumber(paymentId: string, verifiedAt: unknown) {
  const year = verifiedAt ? new Date(String(verifiedAt)).getFullYear() : new Date().getFullYear();
  return `MYGM-${year}-${paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
}

async function embedLetterhead(pdf: PDFDocument, requestUrl: string) {
  const url = new URL('/letterhead.jpg', requestUrl);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`LETTERHEAD_${response.status}`);
  const image = await pdf.embedJpg(new Uint8Array(await response.arrayBuffer()));
  const pageWidth = 595;
  const pageHeight = image.height * (pageWidth / image.width);
  return { image, pageWidth, pageHeight };
}

async function buildPdf(context: ReceiptContext, number: string, requestUrl: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const dark = rgb(0.16, 0.13, 0.12);
  const gold = rgb(0.60, 0.42, 0.12);
  const maroon = rgb(0.35, 0.04, 0.04);
  const { image, pageWidth, pageHeight } = await embedLetterhead(pdf, requestUrl);
  const imageHeight = Math.min(pageHeight, 842);
  page.drawImage(image, { x: 0, y: 842 - imageHeight, width: pageWidth, height: imageHeight });

  const contentTop = Math.max(842 - imageHeight - 36, 560);
  const row = (label: string, value: string, y: number) => {
    page.drawText(label, { x: 80, y, size: 10, font: bold, color: maroon });
    page.drawText(value || '-', { x: 230, y, size: 10, font: regular, color: dark, maxWidth: 285 });
    page.drawLine({ start: { x: 80, y: y - 7 }, end: { x: 515, y: y - 7 }, thickness: 0.4, color: rgb(0.80, 0.75, 0.67) });
  };

  page.drawText('PAYMENT RECEIPT', { x: 205, y: contentTop, size: 18, font: bold, color: maroon });
  page.drawText(`Receipt No: ${number}`, { x: 80, y: contentTop - 30, size: 9, font: regular, color: dark });
  page.drawText(`Date: ${dateText(context.payment.verifiedAt || context.payment.updatedAt)}`, { x: 390, y: contentTop - 30, size: 9, font: regular, color: dark });
  row('Received From', context.owner?.name || context.owner?.email || '-', contentTop - 70);
  row('Amount', money(context.payment.amountPaise), contentTop - 108);
  row('Purpose', context.event?.title || context.account?.purpose || context.bill?.category || 'Other Payment', contentTop - 146);
  row('Payment Type', context.account?.displayName || 'Payment', contentTop - 184);
  row('Transaction ID / UTR', context.payment.transactionId || '-', contentTop - 222);
  row('Payment Status', 'VERIFIED', contentTop - 260);

  for (const path of AUTHORIZED_LOGO_BLACK_PATHS) {
    page.drawSvgPath(path, { x: 355, y: 42, scale: 0.12, color: rgb(0, 0, 0) });
  }
  page.drawText('Authorized Signature', { x: 365, y: 180, size: 10, font: regular, color: dark });
  page.drawLine({ start: { x: 360, y: 190 }, end: { x: 515, y: 190 }, thickness: 0.8, color: gold });
  page.drawText('Avnish Patel', { x: 360, y: 165, size: 10, font: bold, color: maroon });
  page.drawText('President', { x: 360, y: 151, size: 9, font: regular, color: dark });
  return pdf.save();
}

export async function generateAndStoreReceipt(input: { paymentId: string; societyId: string; requestUrl: string }) {
  const context = await loadContext(input.paymentId, input.societyId);
  if (!context) throw new Error('VERIFIED_PAYMENT_NOT_FOUND');
  if (context.payment.receiptStoragePath && context.payment.receiptNumber) {
    return { receiptNumber: context.payment.receiptNumber, receiptStoragePath: context.payment.receiptStoragePath, reused: true };
  }
  const number = context.payment.receiptNumber || receiptNumber(context.payment.id, context.payment.verifiedAt);
  const bytes = await buildPdf(context, number, input.requestUrl);
  const path = `${input.societyId}/payment-receipts/${number}.pdf`;
  await storageUpload(path, bytes);
  await rest('Payment', { id: `eq.${input.paymentId}`, societyId: `eq.${input.societyId}`, status: 'eq.VERIFIED' }, {
    method: 'PATCH',
    body: JSON.stringify({ receiptNumber: number, receiptStoragePath: path, receiptGeneratedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
  });
  return { receiptNumber: number, receiptStoragePath: path, reused: false };
}
