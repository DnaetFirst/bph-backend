// ============================================================================
// respaldoService — exporta toda la base a JSON, lo cifra con AES-256-GCM
// y lo guarda en el bucket R2 (binding RESPALDOS). También permite importar
// (descifrar + reemplazar en una transacción).
// ============================================================================

import { cifrarJSON, descifrarJSON } from '../utils/crypto.js';

export class RespaldoService {
  constructor(prisma, env) {
    this.prisma = prisma;
    this.env = env;
  }

  async exportarTodo() {
    const [usuarios, areas, parametros, evaluaciones] = await Promise.all([
      this.prisma.usuario.findMany(),
      this.prisma.area.findMany(),
      this.prisma.parametro.findMany(),
      this.prisma.evaluacion.findMany({ include: { detalles: true } }),
    ]);
    return {
      version: 1,
      generadoEn: new Date().toISOString(),
      usuarios,
      areas,
      parametros,
      evaluaciones,
    };
  }

  /** Genera el respaldo cifrado y lo sube a R2. Devuelve la key del objeto. */
  async generarYSubir() {
    const datos = await this.exportarTodo();
    const cifrado = await cifrarJSON(datos, this.env.BACKUP_ENCRYPTION_KEY);
    const nombre = `respaldo-${new Date().toISOString().slice(0, 10)}.json.enc`;

    await this.env.RESPALDOS.put(nombre, JSON.stringify(cifrado), {
      httpMetadata: { contentType: 'application/json' },
    });

    return nombre;
  }

  async descargarYDescifrar(nombreArchivo) {
    const objeto = await this.env.RESPALDOS.get(nombreArchivo);
    if (!objeto) throw new Error('Respaldo no encontrado');
    const cifrado = JSON.parse(await objeto.text());
    return descifrarJSON(cifrado, this.env.BACKUP_ENCRYPTION_KEY);
  }

  async listarRespaldos() {
    const listado = await this.env.RESPALDOS.list();
    return listado.objects.map((o) => ({ nombre: o.key, tamano: o.size, subido: o.uploaded }));
  }
}
