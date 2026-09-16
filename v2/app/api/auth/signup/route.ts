import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createSession, prisma } from '@/lib/auth';

const SOCIETY_ID = 'demo-society-v2';
const schema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email(), mobile: z.string().trim().min(10).max(15), flatNumber: z.string().trim().min(1).max(30), password: z.string().min(8).max(128) });
const normalizeMobile = (value: string) => value.replace(/[^0-9+]/g, '');

export async function POST(req: Request) {
  try {
    let body: z.infer<typeof schema>;
    try { body = schema.parse(await req.json()); } catch { return NextResponse.json({ error: 'Please enter valid signup details. Password must be at least 8 characters.' }, { status: 400 }); }
    const email = body.email.toLowerCase();
    const mobile = normalizeMobile(body.mobile);
    const society = await prisma.society.findUnique({ where: { id: SOCIETY_ID } });
    if (!society) return NextResponse.json({ error: 'Society registration is not ready yet. Please ask the society administrator.' }, { status: 503 });
    const flat = await prisma.flat.findFirst({ where: { societyId: society.id, flatNumber: body.flatNumber, status: 'ACTIVE' } });
    if (!flat) return NextResponse.json({ error: 'This flat is not registered or is inactive. Please contact the society administrator.' }, { status: 404 });
    const eligibility = await prisma.$queryRaw<Array<{ signupEnabled: boolean }>>`SELECT "signupEnabled" FROM public."Flat" WHERE id=${flat.id} LIMIT 1`;
    if (!eligibility[0]?.signupEnabled) return NextResponse.json({ error: 'Owner signup is not enabled for this flat. Please contact the society administrator.' }, { status: 403 });
    const registeredEmail = flat.email?.trim().toLowerCase();
    const registeredMobile = flat.mobile ? normalizeMobile(flat.mobile) : null;
    if (!registeredEmail && !registeredMobile) return NextResponse.json({ error: 'This flat is not pre-registered for online signup.' }, { status: 403 });
    if (registeredEmail && registeredEmail !== email) return NextResponse.json({ error: 'The email does not match the society record for this flat.' }, { status: 403 });
    if (registeredMobile && registeredMobile !== mobile) return NextResponse.json({ error: 'The mobile number does not match the society record for this flat.' }, { status: 403 });
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) return NextResponse.json({ error: 'An account with this email already exists. Please login instead.' }, { status: 409 });
    const existingFlatOwner = await prisma.user.findFirst({ where: { societyId: society.id, flatId: flat.id, role: 'OWNER' }, select: { id: true } });
    if (existingFlatOwner) return NextResponse.json({ error: 'This flat already has a registered owner account. Please login or contact the administrator.' }, { status: 409 });
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({ data: { name: body.name, email, mobile, passwordHash, role: 'OWNER', status: 'ACTIVE', societyId: society.id, flatId: flat.id } });
    if (!flat.ownerName || !flat.mobile) await prisma.flat.update({ where: { id: flat.id }, data: { ownerName: flat.ownerName || body.name, mobile: flat.mobile || mobile } });
    await createSession({ id: user.id, role: 'OWNER', societyId: society.id, email: user.email, name: user.name });
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, societyId: society.id, flatId: flat.id } }, { status: 201 });
  } catch (error) { console.error('[auth/signup] server error', error); return NextResponse.json({ error: 'Signup service temporarily unavailable' }, { status: 500 }); }
}
