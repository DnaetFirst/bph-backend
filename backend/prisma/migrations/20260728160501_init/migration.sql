-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "hashPin" TEXT NOT NULL,
    "requiereCambioPin" BOOLEAN NOT NULL DEFAULT false,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametro" (
    "id" SERIAL NOT NULL,
    "categoria" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Parametro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluacion" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "trabajador" TEXT NOT NULL,
    "areaId" INTEGER NOT NULL,
    "evaluadorId" INTEGER NOT NULL,
    "creadoPorId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "higienePorcentaje" INTEGER,
    "uniformePorcentaje" INTEGER,
    "generalPorcentaje" INTEGER,
    "clasificacion" TEXT,
    "colorEsperado" TEXT,
    "colorObservado" TEXT,
    "cumplimientoColor" TEXT,
    "observaciones" VARCHAR(500),
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    "anuladoEn" TIMESTAMP(3),
    "anuladoPorId" INTEGER,
    "motivoAnulacion" VARCHAR(300),
    "anuladoPorLegado" TEXT,
    "hashAnterior" TEXT,
    "hashIntegridad" TEXT,

    CONSTRAINT "Evaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleEvaluacion" (
    "id" SERIAL NOT NULL,
    "evaluacionId" TEXT NOT NULL,
    "parametroId" INTEGER NOT NULL,
    "resultado" TEXT NOT NULL,

    CONSTRAINT "DetalleEvaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" VARCHAR(600),
    "ipCliente" TEXT,
    "userAgent" TEXT,
    "hashAnterior" TEXT,
    "hashIntegridad" TEXT,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_nombre_key" ON "Usuario"("nombre");

-- CreateIndex
CREATE INDEX "Usuario_activo_idx" ON "Usuario"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "Area_nombre_key" ON "Area"("nombre");

-- CreateIndex
CREATE INDEX "Parametro_categoria_activo_idx" ON "Parametro"("categoria", "activo");

-- CreateIndex
CREATE INDEX "Evaluacion_areaId_fecha_idx" ON "Evaluacion"("areaId", "fecha");

-- CreateIndex
CREATE INDEX "Evaluacion_trabajador_idx" ON "Evaluacion"("trabajador");

-- CreateIndex
CREATE INDEX "Evaluacion_estado_idx" ON "Evaluacion"("estado");

-- CreateIndex
CREATE INDEX "Evaluacion_creadoEn_idx" ON "Evaluacion"("creadoEn");

-- CreateIndex
CREATE INDEX "Auditoria_fechaHora_idx" ON "Auditoria"("fechaHora");

-- CreateIndex
CREATE INDEX "Auditoria_usuarioId_idx" ON "Auditoria"("usuarioId");

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_evaluadorId_fkey" FOREIGN KEY ("evaluadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleEvaluacion" ADD CONSTRAINT "DetalleEvaluacion_evaluacionId_fkey" FOREIGN KEY ("evaluacionId") REFERENCES "Evaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleEvaluacion" ADD CONSTRAINT "DetalleEvaluacion_parametroId_fkey" FOREIGN KEY ("parametroId") REFERENCES "Parametro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
