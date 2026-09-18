-- Add database-backed login abuse controls.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginLockedUntil" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "User_loginLockedUntil_idx" ON "User"("loginLockedUntil");
CREATE INDEX IF NOT EXISTS "User_societyId_flatId_role_idx" ON "User"("societyId","flatId","role");
