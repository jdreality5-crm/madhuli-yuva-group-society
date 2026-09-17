-- Property/unit foundation for combined Pramukhpark Society + Sarang Apartment.
-- Idempotent because the corresponding production database objects were already
-- created during the initial rollout; this migration brings Prisma history in sync.

DO $$ BEGIN
  CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'TENAMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ResidentType" AS ENUM ('OWNER', 'TENANT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Property" (
  "id" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "type" "PropertyType" NOT NULL,
  "name" TEXT NOT NULL,
  "propertyNumber" TEXT NOT NULL,
  "block" TEXT,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Property_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Property_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Property_societyId_type_propertyNumber_key" ON "Property"("societyId", "type", "propertyNumber");
CREATE INDEX IF NOT EXISTS "Property_societyId_type_status_idx" ON "Property"("societyId", "type", "status");
CREATE INDEX IF NOT EXISTS "Property_societyId_idx" ON "Property"("societyId");

CREATE TABLE IF NOT EXISTS "PropertyUnit" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "floorNumber" INTEGER NOT NULL,
  "floorLabel" TEXT NOT NULL,
  "residentType" "ResidentType",
  "ownerName" TEXT,
  "ownerMobile" TEXT,
  "ownerEmail" TEXT,
  "residentUserId" TEXT,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyUnit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyUnit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PropertyUnit_residentUserId_fkey" FOREIGN KEY ("residentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PropertyUnit_propertyId_label_key" ON "PropertyUnit"("propertyId", "label");
CREATE INDEX IF NOT EXISTS "PropertyUnit_propertyId_floorNumber_idx" ON "PropertyUnit"("propertyId", "floorNumber");
CREATE INDEX IF NOT EXISTS "PropertyUnit_residentUserId_idx" ON "PropertyUnit"("residentUserId");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "unitId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "residentType" "ResidentType";

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "User_unitId_idx" ON "User"("unitId");
