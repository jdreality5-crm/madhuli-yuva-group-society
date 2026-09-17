CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "User"
  ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "User_societyId_role_approvalStatus_idx" ON "User"("societyId", "role", "approvalStatus");
