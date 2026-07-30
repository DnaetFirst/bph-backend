// ============================================================================
// trabajadorService — Servicio para gestión de trabajadores
// ============================================================================

export class TrabajadorService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async obtenerTodos(soloActivos = true) {
    const where = soloActivos ? { activo: true } : {};
    return this.prisma.trabajador.findMany({
      where,
      include: {
        area: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });
  }

  async obtenerPorId(id) {
    return this.prisma.trabajador.findUnique({
      where: { id },
      include: {
        area: true,
      },
    });
  }

  async crear(datos) {
    const { nombre, areaId } = datos;
    
    // Verificar que el área existe
    const area = await this.prisma.area.findUnique({
      where: { id: areaId },
    });
    
    if (!area) {
      throw new Error('El área especificada no existe');
    }

    // Verificar que no exista un trabajador activo con el mismo nombre
    const existenteActivo = await this.prisma.trabajador.findFirst({
      where: { 
        nombre,
        activo: true 
      },
    });
    
    if (existenteActivo) {
      throw new Error('Ya existe un trabajador activo con ese nombre');
    }

    // Usar upsert para manejar el unique constraint de forma atómica
    return this.prisma.trabajador.upsert({
      where: { nombre },
      update: {
        areaId,
        activo: true,
      },
      create: {
        nombre,
        areaId,
        activo: true,
      },
      include: {
        area: true,
      },
    });
  }

  async actualizar(id, datos) {
    console.log('[DEBUG BACKEND SERVICE] actualizar llamado, id:', id, 'datos:', datos);
    const { nombre, areaId, activo } = datos;
    
    // Verificar que el trabajador existe
    const existente = await this.prisma.trabajador.findUnique({
      where: { id },
    });
    
    console.log('[DEBUG BACKEND SERVICE] Trabajador existente:', existente);
    console.log('[DEBUG BACKEND SERVICE] Estado actual de activo:', existente?.activo);
    
    if (!existente) {
      throw new Error('El trabajador no existe');
    }

    // Si se cambia el nombre, verificar que no exista otro con ese nombre
    if (nombre && nombre !== existente.nombre) {
      const nombreExistente = await this.prisma.trabajador.findUnique({
        where: { nombre },
      });
      
      if (nombreExistente) {
        throw new Error('Ya existe un trabajador con ese nombre');
      }
    }

    // Si se cambia el área, verificar que exista
    if (areaId && areaId !== existente.areaId) {
      const area = await this.prisma.area.findUnique({
        where: { id: areaId },
      });
      
      if (!area) {
        throw new Error('El área especificada no existe');
      }
    }

    console.log('[DEBUG BACKEND SERVICE] Datos a actualizar en DB:', {
      ...(nombre !== undefined && { nombre }),
      ...(areaId !== undefined && { areaId }),
      ...(activo !== undefined && { activo })
    });
    
    console.log('[DEBUG BACKEND SERVICE] Ejecutando prisma.trabajador.update...');
    const resultado = await this.prisma.trabajador.update({
      where: { id },
      data: {
        ...(nombre && { nombre }),
        ...(areaId && { areaId }),
        ...(activo !== undefined && { activo }),
      },
      include: {
        area: true,
      },
    });
    
    console.log('[DEBUG BACKEND SERVICE] Prisma update completado');
    console.log('[DEBUG BACKEND SERVICE] Trabajador actualizado - Tipo:', typeof resultado);
    console.log('[DEBUG BACKEND SERVICE] Trabajador actualizado - Es null?:', resultado === null);
    console.log('[DEBUG BACKEND SERVICE] Trabajador actualizado - ID:', resultado?.id);
    console.log('[DEBUG BACKEND SERVICE] Trabajador actualizado - Nombre:', resultado?.nombre);
    console.log('[DEBUG BACKEND SERVICE] Trabajador actualizado - Activo:', resultado?.activo);
    console.log('[DEBUG BACKEND SERVICE] Trabajador actualizado completo:', JSON.stringify(resultado));
    
    // Verificar que el cambio persistió leyendo de nuevo
    const verificacion = await this.prisma.trabajador.findUnique({
      where: { id },
      include: { area: true }
    });
    console.log('[DEBUG BACKEND SERVICE] Verificación post-update:', verificacion?.activo);
    
    return resultado;
  }

  async desactivar(id) {
    console.log('[DEBUG BACKEND SERVICE] desactivar llamado, id:', id);
    const resultado = await this.actualizar(id, { activo: false });
    console.log('[DEBUG BACKEND SERVICE] desactivar completado, resultado:', resultado);
    return resultado;
  }

  async activar(id) {
    return this.actualizar(id, { activo: true });
  }

  async eliminar(id) {
    // Verificar que el trabajador existe
    const trabajador = await this.prisma.trabajador.findUnique({
      where: { id },
    });
    
    if (!trabajador) {
      // Si no existe, consideramos la operación exitosa (idempotente)
      return { id, eliminado: false, razon: 'El trabajador no existe' };
    }

    try {
      return await this.prisma.trabajador.delete({
        where: { id },
      });
    } catch (error) {
      // Si falla porque no existe, considerar exitoso (idempotente)
      if (error.code === 'P2025') {
        return { id, eliminado: false, razon: 'El trabajador no existe' };
      }
      throw error;
    }
  }

  async obtenerPorArea(areaId, soloActivos = true) {
    const where = {
      areaId,
      ...(soloActivos && { activo: true }),
    };
    
    return this.prisma.trabajador.findMany({
      where,
      include: {
        area: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });
  }
}
