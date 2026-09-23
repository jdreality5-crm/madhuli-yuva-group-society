import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Report PDF route temporarily unavailable while restoration is completed.' }, { status: 503 });
}
