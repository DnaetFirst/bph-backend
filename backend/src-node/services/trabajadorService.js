export class TrabajadorService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async obtenerTodos(soloActivos = true) {
    const where = soloActivos ? { activo: true } : {};

    return this.prisma.trabajador.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        activo: true,
        areaId: true,
        creadoEn: true,
        area: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: [
        { activo: 'desc' },
        { nombre: 'asc' },
      ],
    });
  }

  async obtenerPorId(id) {
    return this.prisma.trabajador.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        activo: true,
        areaId: true,
        creadoEn: true,
        area: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });
  }

  async crear({ nombre, areaId }) {
    const area = await this.prisma.area.findUnique({ where: { id: areaId } });
    if (!area) {
      throw new Error('El área especificada no existe');
    }

    const nombreNormalizado = nombre.trim();
    const existenteActivo = await this.prisma.trabajador.findFirst({
      where: { nombre: nombreNormalizado, activo: true },
    });

    if (existenteActivo) {
      throw new Error('Ya existe un trabajador activo con ese nombre');
    }

    return this.prisma.trabajador.upsert({
      where: { nombre: nombreNormalizado },
      update: {
        areaId,
        activo: true,
      },
      create: {
        nombre: nombreNormalizado,
        areaId,
        activo: true,
      },
      include: {
        area: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });
  }

  async actualizar(id, datos) {
    const existente = await this.prisma.trabajador.findUnique({ where: { id } });
    if (!existente) {
      throw new Error('El trabajador no existe');
    }

    const data = {};

    if (typeof datos.nombre === 'string') {
      const nombreNormalizado = datos.nombre.trim();
      if (nombreNormalizado !== existente.nombre) {
        const nombreExistente = await this.prisma.trabajador.findUnique({
          where: { nombre: nombreNormalizado },
        });

        if (nombreExistente && nombreExistente.id !== id) {
          throw new Error('Ya existe un trabajador con ese nombre');
        }
      }
      data.nombre = nombreNormalizado;
    }

    if (typeof datos.areaId === 'number') {
      const area = await this.prisma.area.findUnique({ where: { id: datos.areaId } });
      if (!area) {
        throw new Error('El área especificada no existe');
      }
      data.areaId = datos.areaId;
    }

    if (typeof datos.activo === 'boolean') {
      data.activo = datos.activo;
    }

    return this.prisma.trabajador.update({
      where: { id },
      data,
      include: {
        area: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });
  }

  async activar(id) {
    return this.actualizar(id, { activo: true });
  }

  async desactivar(id) {
    return this.actualizar(id, { activo: false });
  }

  async eliminar(id) {
    const trabajador = await this.prisma.trabajador.findUnique({
      where: { id },
      select: { id: true, activo: true },
    });

    if (!trabajador) {
      throw new Error('El trabajador no existe');
    }

    if (trabajador.activo) {
      throw new Error('Solo se puede eliminar un trabajador desactivado');
    }

    const evaluacionesRelacionadas = await this.prisma.evaluacion.count({
      where: { trabajadorId: id },
    });

    if (evaluacionesRelacionadas > 0) {
      throw new Error('No se puede eliminar el trabajador porque tiene evaluaciones relacionadas');
    }

    await this.prisma.trabajador.delete({ where: { id } });
    return { ok: true };
  }
}
