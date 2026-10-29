import { normalizar, transaccion, auditar } from './catalogos.js';

const categorias = [
  ['Comidas', 'Tipo de plato', 'Porciones', ['Milaneza de pollo', 'Keperi', 'Majadito de charque', 'Silpancho', 'Picante de pollo', 'Albondigas atomatadas', 'Carbonara', 'Boloñesa', 'Arroz chaufa', 'Pork Belly', 'Pollo al horno']],
  ['Cárnicos', 'Tipo de corte', 'Bandejas', ['Filete', 'Molida', 'Cubo']],
  ['Embutidos', 'Tipo de embutido', 'Bandejas', ['Mortadela Jamonada', 'Mortadela Familiar', 'Mortadela Primavera']],
  ['Quesos', 'Tipo de queso', 'Bandejas', ['Laminado', 'En barra']],
  ['Salsas', 'Tipo de salsa', 'Unidades', ['Salsa Teriyaki', 'Salsa pico de gallo']],
  ['Panes y Postres', 'Tipo de producto', 'Unidades', ['Pan francés', 'Casero con queso', 'Casero con harina', 'Marraqueta con queso', 'Tres leches', 'Brownie']],
  ['Otros', 'Tipo de producto', 'Unidades', []],
];
// Solo inserta ausentes. Nunca actualiza ni reactiva opciones administradas por usuarios.
export async function sembrarCatalogos(db) {
  return transaccion(db, async tx => {
    async function ensure(model, entidad, where, data) {
      const semilla = `${model}:${JSON.stringify(where)}`;
      const found = await tx[model].findUnique({ where: { semilla } }) || await tx[model].findUnique({ where });
      if (found) return found;
      const row = await tx[model].create({ data: { ...data, semilla } });
      await auditar(tx, entidad, null, row, null, 'Inicializar', 'Catálogo inicial CEPROD');
      return row;
    }
    const unidades = {};
    for (const [nombre, abreviatura] of [['Porciones', 'porc.'], ['Bandejas', 'band.'], ['Unidades', 'ud.']]) {
      const clave = normalizar(nombre);
      unidades[nombre] = await ensure('unidadMedida', 'unidades', { clave }, { nombre, clave, abreviatura, decimales: 0 });
    }
    for (const nombre of ['Vencimiento', 'Daño en el producto', 'Error de producción', 'Control de calidad', 'Otro']) {
      const clave = normalizar(nombre);
      await ensure('motivoBaja', 'motivos', { clave }, { nombre, clave, todasCategorias: true, explicacionObligatoria: nombre === 'Otro' });
    }
    for (const [orden, [nombre, etiquetaTipo, unidad, productos]] of categorias.entries()) {
      const clave = normalizar(nombre);
      const c = await ensure('categoriaProducto', 'categorias', { clave }, { nombre, clave, etiquetaTipo, orden, requiereTipo: nombre === 'Cárnicos', requiereProveedor: nombre === 'Cárnicos' });
      if (nombre === 'Cárnicos') for (const nombre of ['A: BFC', 'B: INDUCARNE', 'C: BOVINZA']) {
        const clave = normalizar(nombre);
        await ensure('proveedorBaja', 'proveedores', { clave }, { nombre, clave, todasCategorias: false, categorias: { create: { categoriaId: c.id } } });
      }
      for (const nombreProducto of productos) {
        const clave = normalizar(nombreProducto);
        let tipoId = null;
        if (nombre === 'Cárnicos') tipoId = (await ensure('tipoProducto', 'tipos', { categoriaId_clave: { categoriaId: c.id, clave } }, { nombre: nombreProducto, clave, categoriaId: c.id })).id;
        const existing = await tx.productoBaja.findUnique({ where: { semilla: `productoBaja:${JSON.stringify({ categoriaId_clave: { categoriaId: c.id, clave } })}` } }) || await tx.productoBaja.findUnique({ where: { categoriaId_clave: { categoriaId: c.id, clave } } });
        if (existing) continue;
        const p = await ensure('productoBaja', 'productos', { categoriaId_clave: { categoriaId: c.id, clave } }, { nombre: nombreProducto, clave, categoriaId: c.id, tipoId });
        await ensure('presentacionProducto', 'presentaciones', { productoId_clave: { productoId: p.id, clave: normalizar(unidad) } }, { nombre: unidad, clave: normalizar(unidad), productoId: p.id, unidadId: unidades[unidad].id, predeterminada: true });
      }
    }
  });
}
