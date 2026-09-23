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
    $old$role in ('MASTER_ADMIN','SUB_ADMIN') or (role='ORGANIZER' and 'PAYMENTS'=any(coalesce(permissions,ARRAY[]::text[])))$old$,
    $new$role='MASTER_ADMIN' or (role='ORGANIZER' and 'PAYMENTS'=any(coalesce(permissions,ARRAY[]::text[])))$new$
  );

  IF updated_def = current_def THEN
    IF position('SUB_ADMIN' in current_def) = 0 THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'invalid reviewer role replacement pattern did not match';
  END IF;

  EXECUTE updated_def;
END $outer$;
