-- Add explicit payment method tracking for resident payment submissions.
-- Nullable keeps existing payment records backward-compatible; application code
-- derives legacy records as UPI when a transaction reference exists, otherwise CASH.
ALTER TABLE "Payment"
ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
