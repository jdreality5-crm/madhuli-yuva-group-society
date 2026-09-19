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
      stage = 'local_user_create';
      const result = await supabaseRpc<any>('create_resident_signup_atomic', {
        p_society_id: society.id, p_name: body.name, p_email: email, p_mobile: mobile,
        p_firebase_uid: firebaseUser.localId, p_flat_id: legacyFlatId || null, p_unit_id: unitId || null,
        p_resident_type: residentType || 'OWNER',
      });
      if (result.kind === 'EMAIL_EXISTS') throw new Error('EMAIL_EXISTS');
      if (result.kind === 'MOBILE_EXISTS') throw new Error('MOBILE_EXISTS');
      if (result.kind === 'UNIT_TAKEN' || result.kind === 'FLAT_TAKEN') throw new Error('RESIDENCE_TAKEN');
      if (result.kind !== 'OK') throw new Error('RESIDENT_CREATE_FAILED');
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
    if (code.includes('MOBILE_EXISTS')) return NextResponse.json({ error: 'This mobile number is already registered in the society portal.' }, { status: 409 });
    if (code.includes('RESIDENCE_TAKEN')) return NextResponse.json({ error: 'This residence was registered by another resident during signup. Please choose another available residence.' }, { status: 409 });
    if (code.includes('INVALID_CONTINUE_URI') || code.includes('UNAUTHORIZED_DOMAIN')) return NextResponse.json({ error: 'Email verification is not configured for this website domain yet. Please contact the society administrator.' }, { status: 503 });
    return NextResponse.json({ error: `Signup service temporarily unavailable. Reference: ${debugId}` }, { status: 500 });
  }
}
