import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createSession, prisma } from '@/lib/auth';

const schema = z.object({ email: z.string().email(), password: z.string().min(1), role: z.enum(['MASTER_ADMIN', 'ORGANIZER', 'OWNER']).optional() });

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || user.status !== 'ACTIVE' || (body.role && user.role !== body.role) || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    await createSession({ id: user.id, role: user.role, societyId: user.societyId, email: user.email, name: user.name });
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, societyId: user.societyId } });
  } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
}
