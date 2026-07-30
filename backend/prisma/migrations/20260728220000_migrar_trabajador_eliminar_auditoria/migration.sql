-- Migración para agregar Trabajador, actualizar Evaluacion y eliminar Auditoria
-- Maneja datos existentes en Evaluacion (64 filas) y Auditoria (342 filas)

-- Paso 1: Crear tabla Trabajador
CREATE TABLE "Trabajador" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "areaId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trabajador_pkey" PRIMARY KEY ("id")
);

-- Paso 2: Crear índices en Trabajador
CREATE INDEX "Trabajador_activo_idx" ON "Trabajador"("activo");
CREATE INDEX "Trabajador_areaId_idx" ON "Trabajador"("areaId");

-- Paso 3: Crear restricción de unicidad para nombre
ALTER TABLE "Trabajador" ADD CONSTRAINT "Trabajador_nombre_key" UNIQUE ("nombre");

-- Paso 4: Crear restricción de clave foránea para areaId
ALTER TABLE "Trabajador" ADD CONSTRAINT "Trabajador_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Paso 5: Migrar trabajadores únicos desde Evaluacion a Trabajador
INSERT INTO "Trabajador" ("nombre", "areaId", "activo", "creadoEn")
SELECT DISTINCT 
    "trabajador" as nombre,
    "areaId",
    true as activo,
    CURRENT_TIMESTAMP as creadoEn
FROM "Evaluacion"
WHERE "trabajador" IS NOT NULL
ON CONFLICT ("nombre") DO NOTHING;

-- Paso 6: Agregar columna trabajadorId a Evaluacion (temporalmente nullable)
ALTER TABLE "Evaluacion" ADD COLUMN "trabajadorId" INTEGER;

-- Paso 7: Actualizar Evaluacion para vincular con Trabajador
UPDATE "Evaluacion" e
SET "trabajadorId" = t.id
FROM "Trabajador" t
WHERE e."trabajador" = t.nombre;

-- Paso 8: Hacer trabajadorId NOT NULL (después de actualizar todos los registros)
ALTER TABLE "Evaluacion" ALTER COLUMN "trabajadorId" SET NOT NULL;

-- Paso 9: Crear restricción de clave foránea para trabajadorId
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_trabajadorId_fkey" FOREIGN KEY ("trabajadorId") REFERENCES "Trabajador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Paso 10: Eliminar columna trabajador (string) de Evaluacion
ALTER TABLE "Evaluacion" DROP COLUMN "trabajador";

-- Paso 11: Eliminar tabla Auditoria
DROP TABLE IF EXISTS "Auditoria";

-- Paso 12: Actualizar índices de Evaluacion
DROP INDEX IF EXISTS "Evaluacion_trabajador_idx";
CREATE INDEX "Evaluacion_trabajadorId_idx" ON "Evaluacion"("trabajadorId");

-- Paso 13: Actualizar relación en Area
ALTER TABLE "Area" ADD COLUMN IF NOT EXISTS "trabajadores" INTEGER[];
