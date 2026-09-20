import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  firebaseAuthConfigured,
  firebaseLookup,
  firebaseSendVerificationEmail,
  firebaseSignIn,
  isGmailAddress,
  normalizeGmail,
} from '@/lib/firebase-auth';

const schema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
});

export async function POST(req: Request) {
  const genericResponse = NextResponse.json({
    message: 'If the account is eligible, a verification email has been sent.',
  });

  try {
    if (!firebaseAuthConfigured()) return NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 });

    const body = schema.parse(await req.json());
    if (!isGmailAddress(body.email)) return genericResponse;

    const auth = await firebaseSignIn(normalizeGmail(body.email), body.password);
    const user = await firebaseLookup(auth.idToken);

    if (user && !user.disabled && !user.emailVerified) {
      await firebaseSendVerificationEmail(auth.idToken);
    }

    return genericResponse;
  } catch (error) {
    console.error('[auth/resend-verification] Firebase error', error);
    return genericResponse;
  }
}
