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
  try {
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await req.json());
    } catch (error) {
      console.error('[auth/login] invalid request payload', error);
      return NextResponse.json({ error: 'Invalid email, password, or role.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    if (!user || !(await bcrypt.compare(body.password, user.passwordHash)) || user.status !== 'ACTIVE' || (body.role && user.role !== body.role)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Residents are admitted only after both email verification and Master Admin approval.
    // Admin/organizer accounts keep their existing status-based login behavior.
    if (user.role === 'OWNER') {
      if (!user.emailVerified) {
        return NextResponse.json({ error: 'Please verify your email before signing in.' }, { status: 403 });
      }
      if (user.approvalStatus !== 'APPROVED') {
        if (user.approvalStatus === 'PENDING') {
          return NextResponse.json({ error: 'Your resident account is awaiting Master Admin approval.' }, { status: 403 });
        }
        return NextResponse.json({ error: 'Your resident registration was not approved.' }, { status: 403 });
      }
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
    return NextResponse.json({ error: 'Login service temporarily unavailable' }, { status: 500 });
  }
}
