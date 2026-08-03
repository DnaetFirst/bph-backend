-- Delete pre-August evaluation details
DELETE FROM "DetalleEvaluacion"
WHERE "evaluacionId" IN (
  SELECT id FROM "Evaluacion" WHERE "creadoEn" < '2026-08-01T00:00:00.000Z'
);

-- Delete pre-August evaluations
DELETE FROM "Evaluacion" WHERE "creadoEn" < '2026-08-01T00:00:00.000Z';

-- Delete pre-August bitacora entries
DELETE FROM "Bitacora" WHERE "creadoEn" < '2026-08-01T00:00:00.000Z';

-- Fix hash chain: first remaining evaluation starts a new chain
UPDATE "Evaluacion"
SET "hashAnterior" = NULL
WHERE id = (
  SELECT id FROM "Evaluacion"
  WHERE "creadoEn" >= '2026-08-01T00:00:00.000Z'
  ORDER BY "creadoEn" ASC
  LIMIT 1
);

-- Add excluyeAreasJson column to Parametro (JSON array of area names to exclude)
ALTER TABLE "Parametro" ADD COLUMN "excluyeAreasJson" TEXT;

-- Exclude uniform params for Producción and Calidad e inocuidad areas
UPDATE "Parametro"
SET "excluyeAreasJson" = '["Producción","Calidad e inocuidad"]'
WHERE categoria = 'uniforme';

