import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type ReceiptContext = {
  payment: any;
  owner: any;
  society: any;
  event: any;
  account: any;
  bill: any;
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
  if (!response.ok) throw new Error(String(data?.message || 'REST'));
  return data as T;
}

async function storageUpload(path: string, bytes: Uint8Array) {
  const { base, key, bucket } = config();
  const response = await fetch(`${base}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: Buffer.from(bytes),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('STORAGE_UPLOAD');
}

export async function signReceipt(path: string | null | undefined) {
  if (!path) return null;
  const { base, key, bucket } = config();
  const response = await fetch(`${base}/storage/v1/object/sign/${encodeURIComponent(bucket)}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths: [path], expiresIn: 3600 }),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error('STORAGE_SIGN');
  const item = Array.isArray(data) ? data[0] : data;
  return item?.signedURL ? base + '/storage/v1' + item.signedURL : null;
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
    rest<any[]>('User', { select: 'id,name,email,mobile,flatId,unitId', id: `eq.${payment.ownerUserId}`, limit: '1' }),
    rest<any[]>('Society', { select: 'id,name,address,city,state,pincode,authorizedSignatory,reportFooter', id: `eq.${societyId}`, limit: '1' }),
    payment.eventId ? rest<any[]>('Event', { select: 'id,title,gujaratiTitle,date', id: `eq.${payment.eventId}`, limit: '1' }) : [],
    rest<any[]>('PaymentAccount', { select: 'id,displayName,purpose', id: `eq.${payment.paymentAccountId}`, limit: '1' }),
    payment.billId ? rest<any[]>('Bill', { select: 'id,type,category,date', id: `eq.${payment.billId}`, limit: '1' }) : [],
  ]);
  return { payment, owner: owners[0] || null, society: societies[0] || null, event: events[0] || null, account: accounts[0] || null, bill: bills[0] || null };
}

function money(value: unknown) {
  const paise = Number(value || 0);
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateText(value: unknown) {
  if (!value) return '-';
  return new Date(String(value)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function receiptNumber(paymentId: string, verifiedAt: unknown) {
  const year = verifiedAt ? new Date(String(verifiedAt)).getFullYear() : new Date().getFullYear();
  return `MYGM-${year}-${paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
}

async function buildPdf(context: ReceiptContext, requestUrl: string, number: string) {
  const letterheadUrl = new URL('/letterhead.jpg', requestUrl).toString();
  const letterheadResponse = await fetch(letterheadUrl, { cache: 'no-store' });
  if (!letterheadResponse.ok) throw new Error('LETTERHEAD_NOT_FOUND');
  const letterhead = await letterheadResponse.arrayBuffer();
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 561]);
  const image = await pdf.embedJpg(letterhead);
  page.drawImage(image, { x: 0, y: 0, width: 842, height: 561 });

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const maroon = rgb(0.35, 0.04, 0.04);
  const gold = rgb(0.60, 0.42, 0.12);
  const dark = rgb(0.16, 0.13, 0.12);
  const x = 112;
  const right = 730;
  const row = (label: string, value: string, y: number) => {
    page.drawText(label, { x, y, size: 12, font: bold, color: maroon });
    page.drawText(value || '-', { x: x + 155, y, size: 12, font: regular, color: dark, maxWidth: 450 });
    page.drawLine({ start: { x, y: y - 8 }, end: { x: right, y: y - 8 }, thickness: 0.45, color: rgb(0.80, 0.75, 0.67) });
  };

  page.drawText('PAYMENT RECEIPT', { x: 315, y: 338, size: 20, font: bold, color: maroon });
  page.drawText(`Receipt No: ${number}`, { x: 112, y: 313, size: 10, font: regular, color: dark });
  page.drawText(`Date: ${dateText(context.payment.verifiedAt || context.payment.updatedAt)}`, { x: 640, y: 313, size: 10, font: regular, color: dark });

  row('Received From', context.owner?.name || context.owner?.email || '-', 286);
  row('Amount', money(context.payment.amountPaise), 258);
  row('Purpose', context.event?.title || context.account?.purpose || context.bill?.category || 'Other Payment', 230);
  row('Payment Type', context.account?.displayName || 'Payment', 202);
  row('Transaction ID / UTR', context.payment.transactionId || '-', 174);
  row('Payment Status', 'VERIFIED', 146);

  page.drawText('Authorized Signature', { x: 590, y: 106, size: 10, font: regular, color: dark });
  page.drawLine({ start: { x: 585, y: 116 }, end: { x: 730, y: 116 }, thickness: 0.8, color: gold });
  page.drawText(context.society?.authorizedSignatory || 'Authorized Signatory', { x: 585, y: 92, size: 10, font: bold, color: maroon, maxWidth: 145 });
  return pdf.save();
}

export async function generateAndStoreReceipt(input: { paymentId: string; societyId: string; requestUrl: string }) {
  const context = await loadContext(input.paymentId, input.societyId);
  if (!context) throw new Error('VERIFIED_PAYMENT_NOT_FOUND');
  if (context.payment.receiptStoragePath && context.payment.receiptNumber) {
    return { receiptNumber: context.payment.receiptNumber, receiptStoragePath: context.payment.receiptStoragePath, reused: true };
  }
  const number = context.payment.receiptNumber || receiptNumber(context.payment.id, context.payment.verifiedAt);
  const bytes = await buildPdf(context, input.requestUrl, number);
  const path = `${input.societyId}/payment-receipts/${number}.pdf`;
  await storageUpload(path, bytes);
  await rest('Payment', { id: `eq.${input.paymentId}`, societyId: `eq.${input.societyId}`, status: 'eq.VERIFIED' }, {
    method: 'PATCH',
    body: JSON.stringify({ receiptNumber: number, receiptStoragePath: path, receiptGeneratedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
  });
  return { receiptNumber: number, receiptStoragePath: path, reused: false };
}
