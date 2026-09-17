ALTER TABLE "PropertyUnit" ADD COLUMN IF NOT EXISTS "signupEnabled" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "PropertyUnit_propertyId_signupEnabled_idx" ON "PropertyUnit"("propertyId", "signupEnabled");
