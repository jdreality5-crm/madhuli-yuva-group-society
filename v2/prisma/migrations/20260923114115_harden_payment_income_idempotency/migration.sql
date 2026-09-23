DO $$
DECLARE
  fn text;
  current_def text;
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

  IF position('''PAYMENT:''||p.id' in current_def) > 0
     AND position('coalesce(p."paymentMethod"' in current_def) > 0 THEN
    RETURN;
  END IF;

  fn := replace(
    current_def,
    'p."amountPaise",''UPI'',p."transactionId",''Verified payment ''||p.id',
    'p."amountPaise",coalesce(p."paymentMethod",case when p."transactionId" is not null and btrim(p."transactionId") <> '''' then ''UPI'' else ''CASH'' end),''PAYMENT:''||p.id,''Verified payment ''||p.id||case when p."transactionId" is not null and btrim(p."transactionId") <> '''' then '' | Transaction: ''||p."transactionId" else '''' end'
  );

  IF fn = current_def THEN
    RAISE EXCEPTION 'payment function replacement pattern did not match';
  END IF;

  EXECUTE fn;
END $$;
