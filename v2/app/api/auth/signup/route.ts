import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/auth';
import { appConfig } from '@/lib/config';
import { emailVerificationConfigured, sendVerificationOtp } from '@/lib/verification-email';

const schema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email(), mobile: z.string().trim().min(10).max(15), flatNumber: z.string().trim().min(1).max(30).optional(), propertyType: z.enum(['APARTMENT','TENAMENT']).optional(), propertyNumber: z.string().trim().max(50).optional(), unitLabel: z.string().trim().max(80).optional(), residentType: z.enum(['OWNER','TENANT']).optional(), password: z.string().min(8).max(128) });
const normalizeMobile = (value: string) => value.replace(/[^0-9+]/g, '');
const OTP_TTL_MS = 10 * 60 * 1000;
const newOtp = () => { const limit = Math.floor(0x100000000 / 900000) * 900000; const bytes = new Uint32Array(1); do crypto.getRandomValues(bytes); while (bytes[0] >= limit); return String(100000 + (bytes[0] % 900000)); };
const hashOtp = async (otp: string) => { const bytes = new TextEncoder().encode(otp); const digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join(''); };

export async function POST(req: Request) {
  try {
    let body: z.infer<typeof schema>;
    try { body = schema.parse(await req.json()); } catch { return NextResponse.json({ error: 'Please enter valid signup details. Password must be at least 8 characters.' }, { status: 400 }); }
    if (!emailVerificationConfigured()) return NextResponse.json({ error: 'Email verification is not configured yet. Please contact the society administrator.' }, { status: 503 });
    const email = body.email.toLowerCase();
    const mobile = normalizeMobile(body.mobile);
    const society = await prisma.society.findUnique({ where: { id: appConfig.societyId } });
    if (!society) return NextResponse.json({ error: 'Society registration is not ready yet. Please ask the society administrator.' }, { status: 503 });

    let unitId: string | undefined;
    let residentType: 'OWNER' | 'TENANT' | undefined;
    let legacyFlatId: string | undefined;
    if (body.propertyType && body.propertyNumber && body.unitLabel) {
      const property = await prisma.property.findFirst({ where: { societyId: society.id, type: body.propertyType, propertyNumber: body.propertyNumber, status: 'ACTIVE' }, select: { id: true } });
      if (!property) return NextResponse.json({ error: 'This apartment block or tenament is not registered.' }, { status: 404 });
      const unit = await prisma.propertyUnit.findFirst({ where: { propertyId: property.id, label: body.unitLabel, status: 'ACTIVE' }, select: { id: true, residentType: true, ownerMobile: true, ownerEmail: true, residentUserId: true, signupEnabled: true } });
      if (!unit) return NextResponse.json({ error: 'This flat/floor is not registered. Please contact the society administrator.' }, { status: 404 });
      if (!unit.signupEnabled) return NextResponse.json({ error: 'Online signup is not enabled for this residence. Please contact the society administrator.' }, { status: 403 });
      if (!unit.ownerEmail && !unit.ownerMobile) return NextResponse.json({ error: 'This residence is not pre-registered for online signup.' }, { status: 403 });
      if (unit.ownerEmail && unit.ownerEmail.trim().toLowerCase() !== email) return NextResponse.json({ error: 'The email does not match the registered residence.' }, { status: 403 });
      if (unit.ownerMobile && normalizeMobile(unit.ownerMobile) !== mobile) return NextResponse.json({ error: 'The mobile number does not match the registered residence.' }, { status: 403 });
      if (unit.residentUserId) return NextResponse.json({ error: 'This residence already has a registered account.' }, { status: 409 });
      unitId = unit.id; residentType = unit.residentType || body.residentType || 'OWNER';
    } else {
      if (!body.flatNumber) return NextResponse.json({ error: 'Please provide your apartment/tenament unit details.' }, { status: 400 });
      const flat = await prisma.flat.findFirst({ where: { societyId: society.id, flatNumber: body.flatNumber, status: 'ACTIVE' } });
      if (!flat) return NextResponse.json({ error: 'This flat is not registered or is inactive. Please contact the society administrator.' }, { status: 404 });
      if (!flat.signupEnabled) return NextResponse.json({ error: 'Owner signup is not enabled for this flat. Please contact the society administrator.' }, { status: 403 });
      const registeredEmail = flat.email?.trim().toLowerCase(); const registeredMobile = flat.mobile ? normalizeMobile(flat.mobile) : null;
      if (!registeredEmail && !registeredMobile) return NextResponse.json({ error: 'This flat is not pre-registered for online signup.' }, { status: 403 });
      if (registeredEmail && registeredEmail !== email) return NextResponse.json({ error: 'The email does not match the society record for this flat.' }, { status: 403 });
      if (registeredMobile && registeredMobile !== mobile) return NextResponse.json({ error: 'The mobile number does not match the society record for this flat.' }, { status: 403 });
      const existingFlatOwner = await prisma.user.findFirst({ where: { societyId: society.id, flatId: flat.id, role: 'OWNER' }, select: { id: true } });
      if (existingFlatOwner) return NextResponse.json({ error: 'This flat already has a registered owner account. Please login or contact the administrator.' }, { status: 409 });
      legacyFlatId = flat.id; residentType = 'OWNER';
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) return NextResponse.json({ error: existingEmail.role === 'OWNER' && existingEmail.approvalStatus === 'PENDING' ? 'This signup is already awaiting Master Admin approval.' : 'An account with this email already exists. Please login instead.' }, { status: 409 });

    const passwordHash = await bcrypt.hash(body.password, 12);
    const otp = newOtp();
    const tokenHash = await hashOtp(otp);
    const user = await prisma.$transaction(async tx => {
      const created = await tx.user.create({ data: { name: body.name, email, mobile, passwordHash, role: 'OWNER', status: 'INACTIVE', approvalStatus: 'PENDING', emailVerified: false, societyId: society.id, flatId: legacyFlatId, unitId, residentType } });
      if (unitId) {
        const linked = await tx.propertyUnit.updateMany({ where: { id: unitId, residentUserId: null }, data: { residentUserId: created.id, residentType: residentType || 'OWNER', ownerName: body.name, ownerMobile: mobile, ownerEmail: email } });
        if (linked.count !== 1) throw new Error('This residence was just registered by another user. Please try again.');
      }
      await tx.verificationToken.create({ data: { userId: created.id, tokenHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
      return created;
    });
    try { await sendVerificationOtp(email, otp); } catch (error) {
      await prisma.verificationToken.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } });
      throw error;
    }
    return NextResponse.json({ approvalRequired: true, email: user.email, message: 'Profile submitted successfully. A verification code has been sent. Master Admin approval is required before your account can be activated.' }, { status: 201 });
  } catch (error) {
    console.error('[auth/signup] server error', error);
    return NextResponse.json({ error: 'Signup service temporarily unavailable' }, { status: 500 });
  }
}
