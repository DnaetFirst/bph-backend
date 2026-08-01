-- Migración para crear la tabla Bitacora de auditoría

CREATE TABLE IF NOT EXISTS "Bitacora" (
    "id" SERIAL NOT NULL,
    "accion" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "ip" TEXT,
    "detalles" VARCHAR(500),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bitacora_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Bitacora_creadoEn_idx" ON "Bitacora"("creadoEn");
CREATE INDEX IF NOT EXISTS "Bitacora_usuarioId_idx" ON "Bitacora"("usuarioId");

ALTER TABLE "Bitacora" ADD CONSTRAINT "Bitacora_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
