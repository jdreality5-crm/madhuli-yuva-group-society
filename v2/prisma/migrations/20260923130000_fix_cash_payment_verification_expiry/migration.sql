DO $outer$
DECLARE
  current_def text;
  updated_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO current_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'review_payment_atomic'
    AND pg_get_function_identity_arguments(p.oid) = 'p_payment_id text, p_society_id text, p_reviewer_id text, p_action text, p_rejection_reason text';

  IF current_def IS NULL THEN
    RAISE EXCEPTION 'review_payment_atomic function not found';
  END IF;

  updated_def := replace(
    current_def,
    $old$if p_action='VERIFY'
     and p."expiresAt" < now()
     and (p."transactionId" is null or btrim(p."transactionId")='') then$old$,
    $new$if p_action='VERIFY'
     and p."expiresAt" < now()
     and p."paymentMethod" <> 'CASH' then$new$
  );

  updated_def := replace(
    updated_def,
    $old$if p_action='VERIFY'
     and p."expiresAt" < now()
     and p."paymentMethod" <> 'CASH'
     and p."transactionId" is not null
     and btrim(p."transactionId") <> '' then$old$,
    $new$if p_action='VERIFY'
     and p."expiresAt" < now()
     and p."paymentMethod" <> 'CASH' then$new$
  );

  IF updated_def = current_def THEN
    IF position('and p."paymentMethod" <> ''CASH'' then' in current_def) = 0 THEN
      RAISE EXCEPTION 'cash expiry guard replacement pattern did not match';
    ELSE
      RETURN;
    END IF;
  END IF;

  EXECUTE updated_def;
END $outer$;
