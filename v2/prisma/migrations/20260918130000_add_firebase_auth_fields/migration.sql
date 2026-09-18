-- Firebase identity for resident authentication and 15-day contact locks.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firebaseUid" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailLockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mobileLockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_firebaseUid_key" ON "User"("firebaseUid");
