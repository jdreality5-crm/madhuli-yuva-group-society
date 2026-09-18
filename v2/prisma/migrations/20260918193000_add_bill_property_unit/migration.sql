ALTER TABLE "Bill" ADD COLUMN IF NOT EXISTS "propertyUnitId" TEXT;

CREATE INDEX IF NOT EXISTS "Bill_propertyUnitId_date_idx" ON "Bill"("propertyUnitId", "date");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bill_propertyUnitId_fkey') THEN
    ALTER TABLE "Bill" ADD CONSTRAINT "Bill_propertyUnitId_fkey"
      FOREIGN KEY ("propertyUnitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
