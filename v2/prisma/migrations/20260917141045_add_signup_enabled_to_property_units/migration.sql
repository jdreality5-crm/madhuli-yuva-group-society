ALTER TABLE public."PropertyUnit"
  ADD COLUMN IF NOT EXISTS "signupEnabled" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "PropertyUnit_signupEnabled_idx"
  ON public."PropertyUnit"("signupEnabled");
