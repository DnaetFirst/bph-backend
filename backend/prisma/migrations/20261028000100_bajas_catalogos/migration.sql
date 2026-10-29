-- CreateTable
CREATE TABLE "CategoriaProducto" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,
    "desactivadoEn" TIMESTAMPTZ(3),
    "desactivadoPorId" INTEGER,
    "motivoDesactivacion" VARCHAR(500),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "etiquetaTipo" VARCHAR(60) NOT NULL DEFAULT 'Tipo de producto',
    "requiereTipo" BOOLEAN NOT NULL DEFAULT false,
    "requiereProveedor" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CategoriaProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoProducto" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,
    "desactivadoEn" TIMESTAMPTZ(3),
    "desactivadoPorId" INTEGER,
    "motivoDesactivacion" VARCHAR(500),
    "categoriaId" INTEGER NOT NULL,

    CONSTRAINT "TipoProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadMedida" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,
    "desactivadoEn" TIMESTAMPTZ(3),
    "desactivadoPorId" INTEGER,
    "motivoDesactivacion" VARCHAR(500),
    "abreviatura" VARCHAR(12) NOT NULL,
    "decimales" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UnidadMedida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoBaja" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,
    "desactivadoEn" TIMESTAMPTZ(3),
    "desactivadoPorId" INTEGER,
    "motivoDesactivacion" VARCHAR(500),
    "codigo" VARCHAR(40),
    "categoriaId" INTEGER NOT NULL,
    "tipoId" INTEGER,

    CONSTRAINT "ProductoBaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresentacionProducto" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,
    "desactivadoEn" TIMESTAMPTZ(3),
    "desactivadoPorId" INTEGER,
    "motivoDesactivacion" VARCHAR(500),
    "productoId" INTEGER NOT NULL,
    "unidadId" INTEGER NOT NULL,
    "predeterminada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PresentacionProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProveedorBaja" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,
    "desactivadoEn" TIMESTAMPTZ(3),
    "desactivadoPorId" INTEGER,
    "motivoDesactivacion" VARCHAR(500),
    "codigo" VARCHAR(40),
    "todasCategorias" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProveedorBaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotivoBaja" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,
    "desactivadoEn" TIMESTAMPTZ(3),
    "desactivadoPorId" INTEGER,
    "motivoDesactivacion" VARCHAR(500),
    "explicacionObligatoria" BOOLEAN NOT NULL DEFAULT false,
    "todasCategorias" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MotivoBaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProveedorCategoria" (
    "proveedorId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,

    CONSTRAINT "ProveedorCategoria_pkey" PRIMARY KEY ("proveedorId","categoriaId")
);

-- CreateTable
CREATE TABLE "MotivoCategoria" (
    "motivoId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,

    CONSTRAINT "MotivoCategoria_pkey" PRIMARY KEY ("motivoId","categoriaId")
);

-- CreateTable
CREATE TABLE "AccesoModulo" (
    "usuarioId" INTEGER NOT NULL,
    "modulo" VARCHAR(30) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccesoModulo_pkey" PRIMARY KEY ("usuarioId","modulo")
);

-- CreateTable
CREATE TABLE "EventoAuditoriaBajas" (
    "id" TEXT NOT NULL,
    "entidad" VARCHAR(40) NOT NULL,
    "entidadId" VARCHAR(50) NOT NULL,
    "accion" VARCHAR(40) NOT NULL,
    "usuarioId" INTEGER,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" VARCHAR(500) NOT NULL,
    "antes" JSONB,
    "despues" JSONB,

    CONSTRAINT "EventoAuditoriaBajas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BajaProducto" (
    "id" TEXT NOT NULL,
    "productoId" INTEGER NOT NULL,
    "presentacionId" INTEGER NOT NULL,
    "proveedorId" INTEGER,
    "motivoId" INTEGER NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "fechaOperativa" DATE NOT NULL,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'REGISTRADA',
    "version" INTEGER NOT NULL DEFAULT 1,
    "snapshot" JSONB NOT NULL,
    "observaciones" VARCHAR(500),
    "explicacion" VARCHAR(500),
    "motivoRetroactivo" VARCHAR(500),
    "claveIdempotencia" VARCHAR(100) NOT NULL,
    "huella" VARCHAR(64) NOT NULL,
    "anuladoEn" TIMESTAMPTZ(3),
    "anuladoPorId" INTEGER,
    "motivoAnulacion" VARCHAR(500),

    CONSTRAINT "BajaProducto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoriaProducto_activo_nombre_idx" ON "CategoriaProducto"("activo", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaProducto_clave_key" ON "CategoriaProducto"("clave");

-- CreateIndex
CREATE INDEX "TipoProducto_activo_nombre_idx" ON "TipoProducto"("activo", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "TipoProducto_categoriaId_clave_key" ON "TipoProducto"("categoriaId", "clave");

-- CreateIndex
CREATE INDEX "UnidadMedida_activo_nombre_idx" ON "UnidadMedida"("activo", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadMedida_clave_key" ON "UnidadMedida"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoBaja_codigo_key" ON "ProductoBaja"("codigo");

-- CreateIndex
CREATE INDEX "ProductoBaja_activo_nombre_idx" ON "ProductoBaja"("activo", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoBaja_categoriaId_clave_key" ON "ProductoBaja"("categoriaId", "clave");

-- CreateIndex
CREATE INDEX "PresentacionProducto_activo_nombre_idx" ON "PresentacionProducto"("activo", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "PresentacionProducto_productoId_clave_key" ON "PresentacionProducto"("productoId", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "ProveedorBaja_codigo_key" ON "ProveedorBaja"("codigo");

-- CreateIndex
CREATE INDEX "ProveedorBaja_activo_nombre_idx" ON "ProveedorBaja"("activo", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ProveedorBaja_clave_key" ON "ProveedorBaja"("clave");

-- CreateIndex
CREATE INDEX "MotivoBaja_activo_nombre_idx" ON "MotivoBaja"("activo", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "MotivoBaja_clave_key" ON "MotivoBaja"("clave");

-- CreateIndex
CREATE INDEX "EventoAuditoriaBajas_entidad_entidadId_creadoEn_idx" ON "EventoAuditoriaBajas"("entidad", "entidadId", "creadoEn");

-- CreateIndex
CREATE INDEX "BajaProducto_fechaOperativa_id_idx" ON "BajaProducto"("fechaOperativa", "id");

-- CreateIndex
CREATE INDEX "BajaProducto_productoId_fechaOperativa_idx" ON "BajaProducto"("productoId", "fechaOperativa");

-- CreateIndex
CREATE INDEX "BajaProducto_creadoPorId_fechaOperativa_idx" ON "BajaProducto"("creadoPorId", "fechaOperativa");

-- CreateIndex
CREATE INDEX "BajaProducto_estado_fechaOperativa_idx" ON "BajaProducto"("estado", "fechaOperativa");

-- CreateIndex
CREATE UNIQUE INDEX "BajaProducto_creadoPorId_claveIdempotencia_key" ON "BajaProducto"("creadoPorId", "claveIdempotencia");

-- AddForeignKey
ALTER TABLE "TipoProducto" ADD CONSTRAINT "TipoProducto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoBaja" ADD CONSTRAINT "ProductoBaja_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoBaja" ADD CONSTRAINT "ProductoBaja_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "TipoProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentacionProducto" ADD CONSTRAINT "PresentacionProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "ProductoBaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentacionProducto" ADD CONSTRAINT "PresentacionProducto_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "UnidadMedida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorCategoria" ADD CONSTRAINT "ProveedorCategoria_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "ProveedorBaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorCategoria" ADD CONSTRAINT "ProveedorCategoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivoCategoria" ADD CONSTRAINT "MotivoCategoria_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES "MotivoBaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivoCategoria" ADD CONSTRAINT "MotivoCategoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BajaProducto" ADD CONSTRAINT "BajaProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "ProductoBaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BajaProducto" ADD CONSTRAINT "BajaProducto_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "PresentacionProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BajaProducto" ADD CONSTRAINT "BajaProducto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "ProveedorBaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BajaProducto" ADD CONSTRAINT "BajaProducto_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES "MotivoBaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas adicionales no expresables en Prisma 5.
ALTER TABLE "UnidadMedida" ADD CONSTRAINT "UnidadMedida_decimales_check" CHECK ("decimales" BETWEEN 0 AND 3);
ALTER TABLE "BajaProducto" ADD CONSTRAINT "BajaProducto_cantidad_check" CHECK ("cantidad" > 0);
ALTER TABLE "BajaProducto" ADD CONSTRAINT "BajaProducto_estado_check" CHECK ("estado" IN ('REGISTRADA', 'ANULADA'));
CREATE UNIQUE INDEX "PresentacionProducto_una_predeterminada" ON "PresentacionProducto" ("productoId") WHERE "predeterminada" = true;
ALTER TABLE "AccesoModulo" ADD CONSTRAINT "AccesoModulo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "EventoAuditoriaBajas" ADD CONSTRAINT "EventoAuditoriaBajas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "BajaProducto" ADD CONSTRAINT "BajaProducto_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "BajaProducto" ADD CONSTRAINT "BajaProducto_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
CREATE FUNCTION "bajas_auditoria_inmutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'La auditoría de Bajas no se puede modificar ni eliminar'; END;
$$;
CREATE TRIGGER "EventoAuditoriaBajas_inmutable" BEFORE UPDATE OR DELETE ON "EventoAuditoriaBajas" FOR EACH ROW EXECUTE FUNCTION "bajas_auditoria_inmutable"();
ALTER TABLE "CategoriaProducto" ADD CONSTRAINT "CategoriaProducto_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "CategoriaProducto" ADD CONSTRAINT "CategoriaProducto_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "CategoriaProducto" ADD CONSTRAINT "CategoriaProducto_desactivadoPorId_fkey" FOREIGN KEY ("desactivadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "TipoProducto" ADD CONSTRAINT "TipoProducto_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "TipoProducto" ADD CONSTRAINT "TipoProducto_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "TipoProducto" ADD CONSTRAINT "TipoProducto_desactivadoPorId_fkey" FOREIGN KEY ("desactivadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "UnidadMedida" ADD CONSTRAINT "UnidadMedida_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "UnidadMedida" ADD CONSTRAINT "UnidadMedida_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "UnidadMedida" ADD CONSTRAINT "UnidadMedida_desactivadoPorId_fkey" FOREIGN KEY ("desactivadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "ProductoBaja" ADD CONSTRAINT "ProductoBaja_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "ProductoBaja" ADD CONSTRAINT "ProductoBaja_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "ProductoBaja" ADD CONSTRAINT "ProductoBaja_desactivadoPorId_fkey" FOREIGN KEY ("desactivadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "PresentacionProducto" ADD CONSTRAINT "PresentacionProducto_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "PresentacionProducto" ADD CONSTRAINT "PresentacionProducto_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "PresentacionProducto" ADD CONSTRAINT "PresentacionProducto_desactivadoPorId_fkey" FOREIGN KEY ("desactivadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "ProveedorBaja" ADD CONSTRAINT "ProveedorBaja_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "ProveedorBaja" ADD CONSTRAINT "ProveedorBaja_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "ProveedorBaja" ADD CONSTRAINT "ProveedorBaja_desactivadoPorId_fkey" FOREIGN KEY ("desactivadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "MotivoBaja" ADD CONSTRAINT "MotivoBaja_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "MotivoBaja" ADD CONSTRAINT "MotivoBaja_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "MotivoBaja" ADD CONSTRAINT "MotivoBaja_desactivadoPorId_fkey" FOREIGN KEY ("desactivadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT;
-- Identidad estable para semillas que el usuario puede renombrar.
ALTER TABLE "CategoriaProducto" ADD COLUMN "semilla" TEXT;
CREATE UNIQUE INDEX "CategoriaProducto_semilla_key" ON "CategoriaProducto" ("semilla");
ALTER TABLE "TipoProducto" ADD COLUMN "semilla" TEXT;
CREATE UNIQUE INDEX "TipoProducto_semilla_key" ON "TipoProducto" ("semilla");
ALTER TABLE "UnidadMedida" ADD COLUMN "semilla" TEXT;
CREATE UNIQUE INDEX "UnidadMedida_semilla_key" ON "UnidadMedida" ("semilla");
ALTER TABLE "ProductoBaja" ADD COLUMN "semilla" TEXT;
CREATE UNIQUE INDEX "ProductoBaja_semilla_key" ON "ProductoBaja" ("semilla");
ALTER TABLE "PresentacionProducto" ADD COLUMN "semilla" TEXT;
CREATE UNIQUE INDEX "PresentacionProducto_semilla_key" ON "PresentacionProducto" ("semilla");
ALTER TABLE "ProveedorBaja" ADD COLUMN "semilla" TEXT;
CREATE UNIQUE INDEX "ProveedorBaja_semilla_key" ON "ProveedorBaja" ("semilla");
ALTER TABLE "MotivoBaja" ADD COLUMN "semilla" TEXT;
CREATE UNIQUE INDEX "MotivoBaja_semilla_key" ON "MotivoBaja" ("semilla");
