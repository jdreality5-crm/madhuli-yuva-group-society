import { NextResponse } from 'next/server';
import { z } from 'zod';
import { appConfig } from '@/lib/config';
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

async function supabaseRest<T>(table: string, params: Record<string, string>, init?: RequestInit): Promise<T> {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error('SUPABASE server configuration is missing');
  const url = new URL(base + '/rest/v1/' + table);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json', Prefer: 'return=representation' } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data && typeof data === 'object' && 'message' in data ? String((data as { message: unknown }).message) : '';
    const error = new Error('Supabase ' + table + ' request failed (' + response.status + ')' + (detail ? ': ' + detail.slice(0, 200) : ''));
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return data as T;
}

export async function POST(req: Request) {
  let stage = 'start';
  const debugId = crypto.randomUUID();
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
    stage = 'society_lookup';
    const societies = await supabaseRest<Array<{ id: string }>>('Society', { select: 'id', id: 'eq.' + appConfig.societyId, limit: '1' });
    const society = societies[0];
    if (!society) return NextResponse.json({ error: 'Society registration is not ready yet. Please ask the society administrator.' }, { status: 503 });

    stage = 'residence_lookup';
    let unitId: string | undefined;
    let residentType: 'OWNER' | 'TENANT' | undefined;
    let legacyFlatId: string | undefined;

    if (body.propertyType && body.propertyNumber && body.unitLabel) {
      const properties = await supabaseRest<Array<{ id: string }>>('Property', {
        select: 'id',
        societyId: 'eq.' + society.id,
        type: 'eq.' + body.propertyType,
        propertyNumber: 'eq.' + body.propertyNumber,
        status: 'eq.ACTIVE',
        limit: '1',
      });
      const property = properties[0];
      if (!property) return NextResponse.json({ error: 'This apartment block or tenament is not registered.' }, { status: 404 });

      const units = await supabaseRest<Array<{ id: string; residentType: 'OWNER' | 'TENANT' | null; ownerMobile: string | null; ownerEmail: string | null; residentUserId: string | null }>>('PropertyUnit', {
        select: 'id,residentType,ownerMobile,ownerEmail,residentUserId',
        propertyId: 'eq.' + property.id,
        label: 'eq.' + body.unitLabel,
        status: 'eq.ACTIVE',
        limit: '1',
      });
      const unit = units[0];
      if (!unit) return NextResponse.json({ error: 'This flat/floor is not registered. Please contact the society administrator.' }, { status: 404 });
      if (unit.residentUserId) return NextResponse.json({ error: 'This residence already has a registered account.' }, { status: 409 });
      unitId = unit.id;
      residentType = unit.residentType || body.residentType || 'OWNER';
    } else {
      if (!body.flatNumber) return NextResponse.json({ error: 'Please provide your apartment/tenament unit details.' }, { status: 400 });
      const flats = await supabaseRest<Array<{ id: string; flatNumber: string; ownerName: string | null; mobile: string | null; email: string | null; signupEnabled: boolean }>>('Flat', {
        select: 'id,flatNumber,ownerName,mobile,email,signupEnabled',
        societyId: 'eq.' + society.id,
        flatNumber: 'eq.' + body.flatNumber,
        status: 'eq.ACTIVE',
        limit: '1',
      });
      const flat = flats[0];
      if (!flat) return NextResponse.json({ error: 'This flat is not registered or is inactive. Please contact the society administrator.' }, { status: 404 });
      if (!flat.signupEnabled) return NextResponse.json({ error: 'Owner signup is not enabled for this flat. Please contact the society administrator.' }, { status: 403 });
      const registeredEmail = flat.email?.trim().toLowerCase();
      const registeredMobile = flat.mobile ? normalizeMobile(flat.mobile) : null;
      if (!registeredEmail && !registeredMobile) return NextResponse.json({ error: 'This flat is not pre-registered for online signup.' }, { status: 403 });
      if (registeredEmail && normalizeGmail(registeredEmail) !== email) return NextResponse.json({ error: 'The Gmail address does not match the society record for this flat.' }, { status: 403 });
      if (registeredMobile && registeredMobile !== mobile) return NextResponse.json({ error: 'The mobile number does not match the society record for this flat.' }, { status: 403 });
      const existingFlatOwners = await supabaseRest<Array<{ id: string }>>('User', {
        select: 'id',
        societyId: 'eq.' + society.id,
        flatId: 'eq.' + flat.id,
        role: 'eq.OWNER',
        limit: '1',
      });
      const existingFlatOwner = existingFlatOwners[0];
      if (existingFlatOwner) return NextResponse.json({ error: 'This flat already has a registered resident account. Please login or contact the administrator.' }, { status: 409 });
      legacyFlatId = flat.id;
      residentType = 'OWNER';
    }

    stage = 'duplicate_check';
    const existingEmails = await supabaseRest<Array<{ id: string }>>('User', { select: 'id', email: 'eq.' + email, limit: '1' });
    const existingEmail = existingEmails[0];
    const existingMobiles = await supabaseRest<Array<{ id: string }>>('User', { select: 'id', societyId: 'eq.' + society.id, mobile: 'eq.' + mobile, limit: '1' });
    const existingMobile = existingMobiles[0];
    if (existingMobile) return NextResponse.json({ error: 'This mobile number is already registered in the society portal.' }, { status: 409 });
    if (existingEmail) return NextResponse.json({ error: 'An account with this Gmail address already exists. Please login or use password recovery.' }, { status: 409 });

    stage = 'firebase_signup';
    const firebaseUser = await firebaseSignUp(email, body.password);
    try {
      stage = 'firebase_verification_email';
      await firebaseSendVerificationEmail(firebaseUser.idToken);
      // Signup creates exactly one local User row; a transaction wrapper is unnecessary
      // here and can add avoidable edge-runtime transaction overhead.
      stage = 'local_user_create';
      const createdUsers = await supabaseRest<Array<{ id: string; email: string }>>('User', {}, {
        method: 'POST',
        body: JSON.stringify({
          id: crypto.randomUUID(),
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
          flatId: legacyFlatId || null,
          unitId: unitId || null,
          residentType: residentType || null,
        }),
      });
      const user = createdUsers[0];
      if (!user) throw new Error('Supabase User insert returned no row');
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
    console.error('[auth/signup] server error', { debugId, stage, code: code || 'UNKNOWN' });
    if (code.includes('EMAIL_EXISTS')) return NextResponse.json({ error: 'This Gmail address is already registered. Please login or use password recovery.' }, { status: 409 });
    if (code.includes('INVALID_CONTINUE_URI') || code.includes('UNAUTHORIZED_DOMAIN')) return NextResponse.json({ error: 'Email verification is not configured for this website domain yet. Please contact the society administrator.' }, { status: 503 });
    return NextResponse.json({ error: `Signup service temporarily unavailable. Reference: ${debugId}` }, { status: 500 });
  }
}
