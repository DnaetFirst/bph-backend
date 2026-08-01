ALTER TABLE "Usuario" ADD COLUMN "email" TEXT;
UPDATE "Usuario" SET "email" = 'no-email-' || "id" || '@placeholder.invalid' WHERE "email" IS NULL;
ALTER TABLE "Usuario" ALTER COLUMN "email" SET NOT NULL;
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");