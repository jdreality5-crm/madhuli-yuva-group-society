-- Store immutable receipt metadata for verified payment receipts.
ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "receiptStoragePath" TEXT,
  ADD COLUMN IF NOT EXISTS "receiptGeneratedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_receiptNumber_key"
ON "Payment"("receiptNumber")
WHERE "receiptNumber" IS NOT NULL AND btrim("receiptNumber") <> '';

CREATE INDEX IF NOT EXISTS "Payment_societyId_receiptGeneratedAt_idx"
ON "Payment"("societyId", "receiptGeneratedAt");
