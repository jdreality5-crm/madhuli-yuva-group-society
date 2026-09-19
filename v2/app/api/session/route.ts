import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
    societyId: session.societyId,
    permissions: session.permissions,
  });
}
