import { NextResponse } from 'next/server';
import { z } from 'zod';
import { appConfig } from '@/lib/config';
import { prisma } from '@/lib/auth';
import { firebaseAuthConfigured, firebaseDeleteUser, firebaseSendVerificationEmail, firebaseSignUp, isGmailAddress, normalizeGmail } from '@/lib/firebase-auth';

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  mobile: z.string().trim().min(10).max(15),
  flatNumber: z.string().trim().min(1).max(30).optional(),
  propertyType: z.enum(['APARTMENT','TENAMENT']).optional(),
  propertyNumber: z.string().trim().max(50).optional(),
  unitLabel: z.string().trim().max(80).optional(),
  residentType: z.enum(['OWNER','TENANT']).optional(),
  password: z.string().min(8).max(128),
});

const normalizeMobile = (value: string) => value.replace(/[^0-9+]/g, '');

export async function POST(req: Request) {
  try {
    if (!firebaseAuthConfigured()) {
      return NextResponse.json({ error: 'Firebase Authentication is not configured yet. Please contact the society administrator.' }, { status: 503 });
    }

    let body: z.infer<typeof schema>;
    try { body = schema.parse(await req.json()); }
    catch { return NextResponse.json({ error: 'Please enter valid signup details. Password must be at least 8 characters.' }, { status: 400 }); }

    if (!isGmailAddress(body.email)) {
      return NextResponse.json({ error: 'Only Gmail addresses ending in @gmail.com are allowed for resident signup.' }, { status: 400 });
    }

    const email = normalizeGmail(body.email);
    const mobile = normalizeMobile(body.mobile);
    if (!/^\+?[0-9]{10,15}$/.test(mobile)) {
      return NextResponse.json({ error: 'Please enter a valid mobile number (10 to 15 digits).' }, { status: 400 });
    }
    const society = await prisma.society.findUnique({ where: { id: appConfig.societyId } });
    if (!society) return NextResponse.json({ error: 'Society registration is not ready yet. Please ask the society administrator.' }, { status: 503 });

    let unitId: string | undefined;
    let residentType: 'OWNER' | 'TENANT' | undefined;
    let legacyFlatId: string | undefined;

    if (body.propertyType && body.propertyNumber && body.unitLabel) {
      const property = await prisma.property.findFirst({
        where: { societyId: society.id, type: body.propertyType, propertyNumber: body.propertyNumber, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!property) return NextResponse.json({ error: 'This apartment block or tenament is not registered.' }, { status: 404 });

      const unit = await prisma.propertyUnit.findFirst({
        where: { propertyId: property.id, label: body.unitLabel, status: 'ACTIVE' },
        select: { id: true, residentType: true, ownerMobile: true, ownerEmail: true, residentUserId: true },
      });
      if (!unit) return NextResponse.json({ error: 'This flat/floor is not registered. Please contact the society administrator.' }, { status: 404 });
      if (unit.residentUserId) return NextResponse.json({ error: 'This residence already has a registered account.' }, { status: 409 });
      unitId = unit.id;
      residentType = unit.residentType || body.residentType || 'OWNER';
    } else {
      if (!body.flatNumber) return NextResponse.json({ error: 'Please provide your apartment/tenament unit details.' }, { status: 400 });
      const flat = await prisma.flat.findFirst({ where: { societyId: society.id, flatNumber: body.flatNumber, status: 'ACTIVE' } });
      if (!flat) return NextResponse.json({ error: 'This flat is not registered or is inactive. Please contact the society administrator.' }, { status: 404 });
      if (!flat.signupEnabled) return NextResponse.json({ error: 'Owner signup is not enabled for this flat. Please contact the society administrator.' }, { status: 403 });
      const registeredEmail = flat.email?.trim().toLowerCase();
      const registeredMobile = flat.mobile ? normalizeMobile(flat.mobile) : null;
      if (!registeredEmail && !registeredMobile) return NextResponse.json({ error: 'This flat is not pre-registered for online signup.' }, { status: 403 });
      if (registeredEmail && normalizeGmail(registeredEmail) !== email) return NextResponse.json({ error: 'The Gmail address does not match the society record for this flat.' }, { status: 403 });
      if (registeredMobile && registeredMobile !== mobile) return NextResponse.json({ error: 'The mobile number does not match the society record for this flat.' }, { status: 403 });
      const existingFlatOwner = await prisma.user.findFirst({ where: { societyId: society.id, flatId: flat.id, role: 'OWNER' }, select: { id: true } });
      if (existingFlatOwner) return NextResponse.json({ error: 'This flat already has a registered resident account. Please login or contact the administrator.' }, { status: 409 });
      legacyFlatId = flat.id;
      residentType = 'OWNER';
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    const existingMobile = await prisma.user.findFirst({ where: { societyId: society.id, mobile } });
    if (existingMobile) return NextResponse.json({ error: 'This mobile number is already registered in the society portal.' }, { status: 409 });
    if (existingEmail) return NextResponse.json({ error: 'An account with this Gmail address already exists. Please login or use password recovery.' }, { status: 409 });

    const firebaseUser = await firebaseSignUp(email, body.password);
    try {
      const verificationReturnUrl = new URL('/verify-email?verified=1', req.url).toString();
      await firebaseSendVerificationEmail(firebaseUser.idToken, verificationReturnUrl);
      const user = await prisma.$transaction(async tx => {
        const created = await tx.user.create({
          data: {
            name: body.name,
            email,
            mobile,
            passwordHash: null,
            firebaseUid: firebaseUser.localId,
            role: 'OWNER',
            status: 'INACTIVE',
            approvalStatus: 'APPROVED',
            emailVerified: false,
            societyId: society.id,
            flatId: legacyFlatId,
            unitId,
            residentType,
          },
        });
        return created;
      });
      return NextResponse.json({
        verificationRequired: true,
        email: user.email,
        message: 'Account created. Firebase has sent a verification link to your Gmail address. Open that email to activate your account.',
      }, { status: 201 });
    } catch (error) {
      try { await firebaseDeleteUser(firebaseUser.idToken); } catch (cleanupError) { console.error('[auth/signup] Firebase cleanup failed', cleanupError); }
      throw error;
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code.includes('EMAIL_EXISTS')) return NextResponse.json({ error: 'This Gmail address is already registered. Please login or use password recovery.' }, { status: 409 });
    if (code.includes('INVALID_CONTINUE_URI') || code.includes('UNAUTHORIZED_DOMAIN')) return NextResponse.json({ error: 'Email verification is not configured for this website domain yet. Please contact the society administrator.' }, { status: 503 });
    console.error('[auth/signup] server error', error);
    return NextResponse.json({ error: 'Signup service temporarily unavailable' }, { status: 500 });
  }
}
