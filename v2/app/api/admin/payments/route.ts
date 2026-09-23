import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession, requireSubAdminPermission } from '@/lib/session';
import { generateAndStoreReceipt } from '@/lib/payment-receipt';

const schema = z.object({
  paymentId: z.string().trim().min(1),
  action: z.enum(['VERIFY', 'REJECT']),
  rejectionReason: z.string().trim().max(300).optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.action === 'REJECT' && !value.rejectionReason) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rejectionReason'], message: 'Rejection reason is required.' });
});

async function rest<T>(table: string, query: Record<string, string> = {}, init?: RequestInit) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json', Prefer: 'return=representation' } : {}), ...(init?.headers || {}) }, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Error(String(data?.message || data?.hint || 'REST'));
  return data as T;
}

async function rpc<T>(body: Record<string, unknown>) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw Error('CONFIG');
  const response = await fetch(`${base}/rest/v1/rpc/review_payment_atomic`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Error(String(data?.message || data?.hint || 'RPC'));
  return data as T;
}

async function sign(path: string | null | undefined) {
  if (!path) return null;
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'society-files';
  if (!base || !key) throw Error('CONFIG');
  const response = await fetch(`${base}/storage/v1/object/sign/${encodeURIComponent(bucket)}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ paths: [path], expiresIn: 3600 }), cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Error('STORAGE');
  const item = Array.isArray(data) ? data[0] : data;
  return item?.signedURL ? base + '/storage/v1' + item.signedURL : null;
}

async function removeStorageObject(path: string | null | undefined) {
  if (!path || /^https?:\/\//i.test(path)) return;
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'society-files';
  if (!base || !key) throw Error('CONFIG');
  const response = await fetch(`${base}/storage/v1/object/${encodeURIComponent(bucket)}/remove`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }), cache: 'no-store' });
  if (!response.ok && response.status !== 404) throw Error('STORAGE_DELETE');
}

async function recordVerifiedIncome(paymentId: string, societyId: string, verifierId: string) {
  const payment = (await rest<any[]>('Payment', { select: 'id,societyId,eventId,ownerUserId,amountPaise,paymentMethod,transactionId,notes,verifiedAt,status', id: `eq.${paymentId}`, societyId: `eq.${societyId}`, status: 'eq.VERIFIED', limit: '1' }))[0];
  if (!payment) throw Error('VERIFIED_PAYMENT_NOT_FOUND');
  const referenceNumber = `PAYMENT:${payment.id}`;
  const existing = (await rest<any[]>('Income', { select: 'id', societyId: `eq.${societyId}`, referenceNumber: `eq.${referenceNumber}`, limit: '1' }))[0];
  if (existing) return { created: false, id: existing.id };
  const owner = (await rest<any[]>('User', { select: 'name,email', id: `eq.${payment.ownerUserId}`, societyId: `eq.${societyId}`, limit: '1' }))[0];
  const method = String(payment.paymentMethod || (payment.transactionId ? 'UPI' : 'CASH')).toUpperCase();
  const incomeMethod = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'].includes(method) ? method : 'OTHER';
  const now = new Date().toISOString();
  const row = (await rest<any[]>('Income', { select: '*' }, { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), societyId, eventId: payment.eventId || null, date: payment.verifiedAt || now, category: incomeMethod === 'CASH' ? 'Cash Collection' : 'Payment Collection', description: `Verified payment ${payment.id}`, receivedFrom: owner?.name || owner?.email || 'Resident', amountPaise: String(payment.amountPaise), paymentMethod: incomeMethod, referenceNumber, notes: payment.notes || null, createdById: verifierId, createdAt: now, updatedAt: now }) }))[0];
  return { created: true, id: row?.id || null };
}

async function getVerifiedPayment(paymentId: string, societyId: string) {
  return (await rest<any[]>('Payment', { select: '*', id: `eq.${paymentId}`, societyId: `eq.${societyId}`, status: 'eq.VERIFIED', limit: '1' }))[0] || null;
}

export async function GET() {
  try {
    const session = await requireSubAdminPermission('PAYMENTS');
    const payments = await rest<any[]>('Payment', { select: '*', societyId: `eq.${session.societyId}`, order: 'createdAt.desc' });
    const accountIds = [...new Set(payments.map((row) => row.paymentAccountId).filter(Boolean))];
    const userIds = [...new Set(payments.map((row) => row.ownerUserId).filter(Boolean))];
    const billIds = [...new Set(payments.map((row) => row.billId).filter(Boolean))];
    const eventIds = [...new Set(payments.map((row) => row.eventId).filter(Boolean))];
    const [accounts, users, bills, events] = await Promise.all([
      accountIds.length ? rest<any[]>('PaymentAccount', { select: 'id,displayName,upiId,purpose', id: `in.(${accountIds.join(',')})`, societyId: `eq.${session.societyId}` }) : [],
      userIds.length ? rest<any[]>('User', { select: 'id,name,email,mobile,flatId,unitId', id: `in.(${userIds.join(',')})`, societyId: `eq.${session.societyId}` }) : [],
      billIds.length ? rest<any[]>('Bill', { select: 'id,type,amountPaise,paymentStatus,category,vendor,date', id: `in.(${billIds.join(',')})`, societyId: `eq.${session.societyId}` }) : [],
      eventIds.length ? rest<any[]>('Event', { select: 'id,title,gujaratiTitle', id: `in.(${eventIds.join(',')})`, societyId: `eq.${session.societyId}` }) : [],
    ]);
    const accountMap = new Map(accounts.map((row) => [row.id, row]));
    const userMap = new Map(users.map((row) => [row.id, row]));
    const billMap = new Map(bills.map((row) => [row.id, row]));
    const eventMap = new Map(events.map((row) => [row.id, row]));
    const normalizedPayments = await Promise.all(payments.map(async (row) => ({ ...row, amountPaise: String(row.amountPaise), paymentMethod: row.paymentMethod || (row.transactionId ? 'UPI' : 'CASH'), screenshotUrl: await sign(row.screenshotUrl), paymentAccount: accountMap.get(row.paymentAccountId) || null, ownerUser: userMap.get(row.ownerUserId) || null, bill: billMap.has(row.billId) ? { ...billMap.get(row.billId), amountPaise: String(billMap.get(row.billId).amountPaise) } : null, event: eventMap.get(row.eventId) || null })));
    return NextResponse.json({ payments: normalizedPayments, canDelete: session.role === 'MASTER_ADMIN' });
  } catch (error) {
    console.error('Payment list failed', error instanceof Error ? error.message : error);
    const forbidden = error instanceof Error && error.message === 'FORBIDDEN';
    return NextResponse.json({ error: forbidden ? 'Organizer access required' : 'Server error' }, { status: forbidden ? 403 : 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSubAdminPermission('PAYMENTS');
    const parsed = schema.parse(await req.json());
    let row: any;
    let reconciled = false;
    try {
      row = await rpc<any>({ p_payment_id: parsed.paymentId, p_society_id: session.societyId, p_reviewer_id: session.id, p_action: parsed.action, p_rejection_reason: parsed.rejectionReason || null });
    } catch (reviewError) {
      const reviewMessage = reviewError instanceof Error ? reviewError.message : '';
      if (parsed.action !== 'VERIFY' || !reviewMessage.includes('ALREADY_REVIEWED')) throw reviewError;
      row = await getVerifiedPayment(parsed.paymentId, session.societyId);
      if (!row) throw reviewError;
      reconciled = true;
    }
    let receipt: { receiptNumber: string; receiptStoragePath: string; reused: boolean } | null = null;
    let income: { created: boolean; id: string | null } | null = null;
    const artifactErrors: string[] = [];
    if (parsed.action === 'VERIFY') {
      try {
        income = await recordVerifiedIncome(parsed.paymentId, session.societyId, session.id);
      } catch (incomeError) {
        artifactErrors.push('INCOME');
        console.error('Verified payment income creation failed', incomeError instanceof Error ? incomeError.message : incomeError);
      }
      try {
        receipt = await generateAndStoreReceipt({ paymentId: parsed.paymentId, societyId: session.societyId, requestUrl: req.url });
      } catch (receiptError) {
        artifactErrors.push('RECEIPT');
        console.error('Payment receipt generation failed', receiptError instanceof Error ? receiptError.message : receiptError);
      }
    }
    const payment = { ...row, amountPaise: String(row.amountPaise) };
    if (artifactErrors.length) {
      return NextResponse.json({ payment, receipt, income, reconciled, artifactErrors, error: 'Payment is verified, but financial artifact processing is incomplete. Retry verification to reconcile.' }, { status: 502 });
    }
    return NextResponse.json({ payment, receipt, income, reconciled, artifactErrors: [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    console.error('Payment review failed', message);
    const status = message.includes('NOT_FOUND') ? 404 : message.includes('ALREADY_REVIEWED') ? 409 : error instanceof z.ZodError ? 400 : message.includes('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ error: status === 404 ? 'Payment not found.' : status === 409 ? 'Payment has already been reviewed.' : status === 400 ? 'Invalid review request.' : status === 403 ? 'Organizer access required' : 'Server error' }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSession();
    if (session.role !== 'MASTER_ADMIN') throw Error('FORBIDDEN');
    const body = z.object({ paymentId: z.string().trim().min(1) }).parse(await req.json());
    const rows = await rest<any[]>('Payment', { select: 'id,societyId,screenshotUrl', id: `eq.${body.paymentId}`, societyId: `eq.${session.societyId}`, limit: '1' });
    const payment = rows[0];
    if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    await removeStorageObject(payment.screenshotUrl);
    await rest('Payment', { id: `eq.${body.paymentId}`, societyId: `eq.${session.societyId}` }, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    console.error('Payment request deletion failed', message);
    const status = message === 'FORBIDDEN' ? 403 : error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: status === 403 ? 'Master Admin access required.' : status === 400 ? 'Invalid delete request.' : 'Unable to delete payment request.' }, { status });
  }
}
