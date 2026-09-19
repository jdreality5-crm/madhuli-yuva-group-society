ALTER TABLE "RoleChangeRequest" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RoleChangeRequest" ADD CONSTRAINT "RoleChangeRequest_attempts_nonnegative" CHECK ("attempts" >= 0);
