import { NextResponse } from 'next/server';
import { z } from 'zod';
import { firebaseAuthConfigured, firebaseRequest } from '@/lib/firebase-auth';

const schema = z.object({ oobCode: z.string().min(10), newPassword: z.string().min(8).max(128) });

export async function POST(req: Request) {
  try {
    if (!firebaseAuthConfigured()) return NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 });
    const body = schema.parse(await req.json());
    await firebaseRequest<{ email?: string }>('resetPassword', { oobCode: body.oobCode, newPassword: body.newPassword });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('EXPIRED_OOB_CODE') || message.includes('INVALID_OOB_CODE')) return NextResponse.json({ error: 'This password reset link has expired or has already been used. Please request a new one.' }, { status: 400 });
    if (message.includes('WEAK_PASSWORD')) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    console.error('[auth/reset-password] server error', error);
    return NextResponse.json({ error: 'Password reset temporarily unavailable.' }, { status: 500 });
  }
}
