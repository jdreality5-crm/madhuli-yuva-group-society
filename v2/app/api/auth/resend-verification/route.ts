import { NextResponse } from 'next/server';

/**
 * Legacy compatibility endpoint.
 * New resident verification is handled by Firebase email links.
 * Keeping the old OTP endpoint disabled prevents unauthenticated OTP
 * generation/account enumeration against the legacy verification flow.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Resident verification now uses the Firebase email verification link. Please use the link sent to your Gmail address.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
