import { NextResponse } from 'next/server';
import { prisma, requireSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await requireSession();
    const notices = await prisma.notice.findMany({
      where: { societyId: session.societyId, status: 'PUBLISHED' },
      orderBy: [{ important: 'desc' }, { date: 'desc' }],
    });
    return NextResponse.json(notices);
  } catch (e) {
    const unauthorized = e instanceof Error && e.message === 'UNAUTHORIZED';
    return NextResponse.json({ error: unauthorized ? 'Unauthorized' : 'Forbidden' }, { status: unauthorized ? 401 : 403 });
  }
}