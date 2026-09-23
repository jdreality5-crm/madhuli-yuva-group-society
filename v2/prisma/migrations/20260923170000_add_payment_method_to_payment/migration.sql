-- Idempotent recovery-safe migration: the column may already exist in production.
ALTER TABLE "Payment"
ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod";
