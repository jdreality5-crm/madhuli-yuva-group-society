import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Report PDF route restoration pending.' }, { status: 503 });
}
