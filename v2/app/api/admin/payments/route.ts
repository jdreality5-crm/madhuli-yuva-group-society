import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSubAdminPermission } from '@/lib/session';

const schema = z.object({
  paymentId: z.string().trim().min(1),
  action: z.enum(['VERIFY', 'REJECT']),
  rejectionReason: z.string().trim().max(300).optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.action === 'REJECT' && !value.rejectionReason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rejectionReason'], message: 'Rejection reason is required.' });
  }
});

async function rest<T>(table: string, query: Record<string, string> = {}, init?: RequestInit) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw Error('CONFIG');
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json', Prefer: 'return=representation' } : {}), ...(init?.headers || {}) }, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Error('REST');
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
    return NextResponse.json({ payments: payments.map((row) => ({ ...row, amountPaise: String(row.amountPaise), paymentAccount: accountMap.get(row.paymentAccountId) || null, ownerUser: userMap.get(row.ownerUserId) || null, bill: billMap.has(row.billId) ? { ...billMap.get(row.billId), amountPaise: String(billMap.get(row.billId).amountPaise) } : null, event: eventMap.get(row.eventId) || null })) });
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
    const row = await rpc<any>({ p_payment_id: parsed.paymentId, p_society_id: session.societyId, p_reviewer_id: session.id, p_action: parsed.action, p_rejection_reason: parsed.rejectionReason || null });
    return NextResponse.json({ payment: { ...row, amountPaise: String(row.amountPaise) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    console.error('Payment review failed', message);
    const status = message.includes('NOT_FOUND') ? 404 : message.includes('ALREADY_REVIEWED') ? 409 : error instanceof z.ZodError ? 400 : message.includes('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ error: status === 404 ? 'Payment not found.' : status === 409 ? 'Payment has already been reviewed.' : status === 400 ? 'Invalid review request.' : status === 403 ? 'Organizer access required' : 'Server error' }, { status });
  }
}
