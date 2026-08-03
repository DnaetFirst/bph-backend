-- Add activo field to Area for soft delete support
ALTER TABLE "Area" ADD COLUMN "activo" BOOLEAN DEFAULT true;

-- Ensure all existing areas are active
UPDATE "Area" SET "activo" = true WHERE "activo" IS NULL;
