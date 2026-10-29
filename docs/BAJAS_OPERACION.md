# Bajas CEPROD: uso y operación

## Uso por rol

El administrador encuentra **Bajas** en Inicio y en la navegación. En **Administrar catálogos → Accesos** habilita individualmente a supervisores y registradores, indicando el motivo. No se conceden accesos automáticamente a cuentas existentes. Quitar el acceso se aplica en la siguiente petición al servidor.

Para registrar: **Bajas → Registrar baja**, elegir producto, comprobar categoría y presentación automática, indicar cantidad y motivo, completar proveedor cuando corresponda y guardar. “Otro” exige explicación. **Registrar otra baja** inicia una operación independiente. Ante un fallo de conexión, reintentar conservando los datos; el servidor evita repetir la misma solicitud. Sí se permiten bajas distintas del mismo producto el mismo día.

El registrador ve únicamente sus registros y registra con la fecha actual de Bolivia. Administrador y supervisor consultan todos, pueden registrar fechas anteriores con justificación y corregir o anular con un motivo. No se aceptan fechas futuras. Anular conserva el registro y sus cambios, pero excluye su cantidad de los indicadores efectivos.

## Catálogos sin soporte técnico

Categorías, tipos/cortes, productos, presentaciones, unidades, proveedores y motivos se administran en la misma página. Se pueden agregar opciones desde el formulario sin perder la baja que se estaba preparando. Cada producto se crea con su primera presentación. Las categorías definen si requieren tipo y proveedor; motivos y proveedores pueden aplicarse a todas las categorías o a una selección.

**Desactivar** oculta una opción en nuevos registros. Para recuperarla, filtrar desactivados y elegir **Restaurar**, con motivo. Nunca se borra físicamente. Las dependencias impiden dejar productos sin presentación o categorías sin motivos/proveedores válidos. Primero restaurar unidades/categorías/tipos, después presentaciones y productos según el mensaje de la aplicación. Los datos históricos conservan sus nombres originales. No se puede cambiar unidad de una presentación existente ni reclasificar productos con bajas: se crea otra opción.

## Consulta

El historial abre en el día actual; permite rango de fechas, todos los registros, estado, responsable y filtros por catálogo. El resumen distingue registradas de anuladas y separa cantidades por producto y presentación, mostrando hasta 20 grupos. Las distribuciones usan nombres actuales de catálogo; detalle y exportaciones usan nombres históricos.

Solo gestores exportan o imprimen. Excel/CSV incluye hasta 10.000 registros del filtro, independientemente de la página visible. Impresión admite 1.000. Si se supera el límite se pide reducir el filtro. No se suman unidades heterogéneas.

## Datos y API

PostgreSQL conserva catálogos tipados y sus relaciones, accesos por usuario/módulo, bajas y eventos de auditoría. Una baja guarda producto, presentación, proveedor opcional, motivo, cantidad decimal positiva (hasta 11 enteros y 3 decimales, limitada por unidad), fecha operativa, instante de creación, responsable, explicación, observaciones, justificación retroactiva, estado, versión e identificador de solicitud. El snapshot conserva clasificación, nombres y reglas de ese registro. No se incluyen lotes, fechas de vencimiento, fotografías ni costos; tampoco se importa el almacenamiento del HTML.

Todas las rutas están bajo `/api/v1/bajas`, con sesión existente:

- `GET /sesion`: disponibilidad y permisos; `GET /accesos` y `PUT /accesos/:id`: solo administrador.
- `GET /catalogos/:tipo`: búsqueda/paginación; `POST /catalogos/:tipo`, `PUT /catalogos/:tipo/:id`, `POST /catalogos/:tipo/:id/desactivar|restaurar`: gestores. Las ediciones/estados requieren versión y motivo.
- `GET /`, `/resumen`, `/:id`: consulta con alcance del usuario. `POST /`: registrar con `claveIdempotencia` UUID. `PATCH /:id`: corregir con versión y motivo. `POST /:id/anular`: versión y motivo.
- `GET /exportar?formato=xlsx|csv`, `/imprimir`, `/responsables`, `/:id/eventos` y `/catalogos/:tipo/:id/eventos`: gestores.
- Filtros de bajas: `fechaDesde`, `fechaHasta`, `estado` (TODOS/REGISTRADA/ANULADA), `q`, identificadores de catálogo y `creadoPorId`; paginación `pagina` y `porPagina` (máximo 100). Un registrador no puede ampliar su alcance manipulando estos parámetros.

Los eventos registran antes/después, actor, fecha, acción y motivo en la misma transacción. Un trigger rechaza UPDATE/DELETE sobre auditoría; esto no sustituye controles de acceso del propietario de la base. Versiones evitan sobrescribir cambios simultáneos. Las escrituras de Bajas comparten un bloqueo transaccional para validar dependencias; BPH no toma ese bloqueo.

## Despliegue y recuperación

Backend: Render, repositorio `DnaetFirst/bph-backend`, rama master, `backend` como raíz. `npm run build:node` genera Prisma, aplica migraciones aditivas y semillas idempotentes de catálogos. Nunca crea bajas. Frontend: Worker Cloudflare **ceprod**, URL `https://ceprod.portal-online-dante.workers.dev`; API `https://bph-backend-1.onrender.com/api/v1`. Compilar con `.env.production` y publicar con `wrangler deploy --name ceprod` (el nombre por defecto del archivo sigue siendo frontend).

Antes de migrar: desde backend ejecutar `node scripts/backup-pre-bajas.mjs`; escribe dump privado en `.local/backups`. Restaurar en una base aislada con `pg_restore --no-owner --no-acl`, aplicar migraciones y comparar conteos. No subir respaldos ni secretos al repositorio. `verificar-respaldo-bajas.mjs` compara la base configurada con la restauración local de prueba; no escribe en producción.

Para detener Bajas sin borrar datos, establecer `BAJAS_ENABLED=false` en Render y reiniciar. Revertir código compatible conservando tablas/eventos; no borrar migraciones aplicadas ni bajas. Restaurar un respaldo requiere detener escrituras afectadas y conciliar cambios posteriores, incluidos los de BPH. El respaldo previo está verificado, pero no se ha configurado una política automática de backups ni un RPO/RTO del proveedor.

## Evidencia de validación — 28 octubre 2026

- Pruebas unitarias y de integración sobre PostgreSQL aislado: roles, aislamiento, datos inválidos, concurrencia, idempotencia, auditoría, rollback, snapshots, catálogos y exportaciones. Se conserva la suite previa BPH.
- Backup restaurado y migrado: coincidieron 5 usuarios, 24 trabajadores, 7 áreas, 1.141 evaluaciones, 10.885 detalles y 1.543 eventos BPH; cero bajas en la copia restaurada.
- Recorrido local de navegador: creación contextual de catálogo conservando formulario, registro, detalle y corrección. Sin desbordamiento horizontal en anchos 320, 360, 390, 768, 1024 y 1440 px.
- Carga sintética local de 100.000 bajas: listado 43 ms, resumen con distribuciones 352 ms y búsqueda 40 ms. No representa latencia de Render ni concurrencia de escritura.
- Compilación de producción y lint revisados. Datos sintéticos permanecen en bases locales de prueba.

Pendiente de operación humana: aceptación con usuarios reales de cada rol, validación en dispositivos/navegadores adicionales y con lector de pantalla, política automática de respaldos y observación sostenida de producción. La habilitación individual permite realizar este piloto sin conceder permisos masivos.
