import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createSession, prisma } from '@/lib/auth';

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  role: z.enum(['MASTER_ADMIN', 'ORGANIZER', 'OWNER']).optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof schema>;

  try {
    body = schema.parse(await req.json());
  } catch (error) {
    console.warn('[auth/login] validation error', error);
    return NextResponse.json({ error: 'Invalid email, password, or role.' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });

    if (!user || user.status !== 'ACTIVE' || (body.role && user.role !== body.role)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const passwordMatches = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordMatches) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await createSession({
      id: user.id,
      role: user.role,
      societyId: user.societyId,
      email: user.email,
      name: user.name,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        societyId: user.societyId,
      },
    });
  } catch (error) {
    console.error('[auth/login] server error', error);
    return NextResponse.json({ error: 'Authentication service is temporarily unavailable.' }, { status: 500 });
  }
}
