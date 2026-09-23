-- Add explicit payment method to resident payment requests.
-- Nullable keeps existing historical payment rows compatible.
ALTER TABLE "Payment"
ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod";
