-- Track the payment channel for resident-submitted payments.
-- Nullable keeps existing payment records backward-compatible.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod";
