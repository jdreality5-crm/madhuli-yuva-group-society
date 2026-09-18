import { NextResponse } from 'next/server';
import { z } from 'zod';
import { firebaseAuthConfigured, isGmailAddress, firebaseRequest, normalizeGmail } from '@/lib/firebase-auth';

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(req: Request) {
  try {
    if (!firebaseAuthConfigured()) return NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 });
    const body = schema.parse(await req.json());
    if (!isGmailAddress(body.email)) return NextResponse.json({ message: 'If an eligible account exists, a password reset email has been sent.' });
    try {
      await firebaseRequest('sendOobCode', { requestType: 'PASSWORD_RESET', email: normalizeGmail(body.email) });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!message.includes('EMAIL_NOT_FOUND')) console.error('[auth/forgot-password] Firebase error', error);
    }
    return NextResponse.json({ message: 'If an eligible account exists, a password reset email has been sent.' });
  } catch {
    return NextResponse.json({ error: 'Please enter a valid Gmail address.' }, { status: 400 });
  }
}
