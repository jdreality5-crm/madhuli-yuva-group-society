-- Enforce one payment transaction reference per society.
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_societyId_transactionId_key"
ON "Payment"("societyId", "transactionId")
WHERE "transactionId" IS NOT NULL AND btrim("transactionId") <> '';
