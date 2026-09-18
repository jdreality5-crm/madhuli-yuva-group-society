import { NextResponse } from 'next/server';
import { prisma, requireSession } from '@/lib/auth';
import { createSignedFileUrl } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const session = await requireSession();
    const events = await prisma.event.findMany({
      where: { societyId: session.societyId, status: 'PUBLISHED', visibility: 'OWNER' },
      orderBy: { date: 'asc' },
    });
    return NextResponse.json(events);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error && e.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Forbidden' }, { status: e instanceof Error && e.message === 'UNAUTHORIZED' ? 401 : 403 });
  }
}