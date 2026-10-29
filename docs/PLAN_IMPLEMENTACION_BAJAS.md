# Plan de implementación del módulo de Bajas — CEPROD

Fecha: 28 de octubre de 2026. Estado: especificación para ejecución por etapas; no representa funcionalidad ya implementada.

## 1. Objetivo, acuerdos y límites

Integrar Bajas de productos en la aplicación existente CEPROD, junto a BPH, con la misma URL, sesión, frontend React, API Express y base PostgreSQL administrada con Prisma. No insertar el HTML mediante iframe ni mantener un segundo sistema de almacenamiento.

Decisiones confirmadas por el usuario:

- Administrador y supervisor crean, editan, desactivan y restauran catálogos.
- Otros usuarios autorizados registran bajas; no administran catálogos ni corrigen o anulan registros.
- Una baja válida queda registrada inmediatamente. No habrá flujo de aprobación.
- Eliminar visualmente significa desactivar, conservar y permitir auditoría; no borrar físicamente.
- Lotes, vencimientos, fotografías y costos quedan fuera de este plan, también de sus etapas posteriores.
- Debe funcionar en móvil, tablet y escritorio, y permitir nuevos módulos en el futuro.

No se añade inventario ni descuento de existencias. No se cambia la regla diaria de evaluaciones BPH. No se convierte todo el BPH existente a la arquitectura nueva en una sola entrega.

Decisiones adicionales confirmadas: el registrador consulta únicamente sus propias bajas; supervisor y administrador consultan todas. Solo supervisor y administrador pueden registrar hechos de fechas anteriores. El módulo comienza con cero bajas, sin importación del HTML. El volumen diario es variable: no se requiere una cantidad fija para operar. Una baja representa un producto y una cantidad.

## 2. Evidencia revisada y correcciones necesarias

Fuentes: `registro_bajas_ceprod (1).html`, `backend/prisma/schema.node.prisma`, rutas y servicios de trabajadores y administración, `backend/src-node/utils/bitacora.js`, `frontend/src/App.jsx`, `frontend/src/pages/Trabajadores.jsx` e `index.css`.

El HTML ofrece siete categorías, proveedores para cárnicos, productos adicionales, motivos, edición, resumen diario y Excel/CSV/impresión. Sus registros están en `ceprod_bajas_registro` y los productos extra en `ceprod_productos_extra`, dentro de localStorage del navegador que lo utilizó.

Problemas que debe resolver la integración:

1. Almacenamiento por navegador sin datos compartidos: sustituir por API y PostgreSQL.
2. Historial limitado al día: agregar rango de fechas y consulta de todo el histórico autorizado.
3. Exportación e impresión no respetan la categoría visible: utilizar un único contrato de filtros.
4. Edición y borrado sin identidad ni permisos: aplicar controles en API, no solamente botones ocultos.
5. Limpiar historial elimina físicamente todos los datos: no incorporar esta operación.
6. Cantidades sin control de precisión: validar unidad, rango y decimales tanto en API como en cliente.
7. Listas codificadas: migrarlas a catálogos gestionables.
8. Hora dependiente del dispositivo: registrar con reloj del servidor y mostrar en America/La_Paz.
9. Doble envío y escritura concurrente: idempotencia y control de versión.
10. Auditoría incompleta: registrar cambios estructurados junto con la operación en una transacción.
11. Fechas del resumen con límite final impreciso: intervalos [inicio del día, inicio del día siguiente).
12. Dependencia de localStorage: no trasladar registros del HTML; iniciar Bajas vacío y guardar desde el primer registro en servidor.

BPH ya implementa desactivación/restauración de trabajadores. Se reutiliza el patrón visual, pero no su reactivación implícita al crear: restaurar un catálogo debe ser una acción explícita. La bitácora actual captura errores y permite continuar; no es suficiente como garantía de auditoría de Bajas.

## 3. Navegación y pantallas

Inicio CEPROD mostrará accesos a BPH y Bajas según permisos. Administración reunirá herramientas compartidas. Conservar las rutas actuales de BPH para no romper enlaces.

Rutas propuestas:

- `/bajas`: historial y filtros; acceso principal al módulo.
- `/bajas/nueva`: formulario de registro.
- `/bajas/:id`: detalle, estado e historial de cambios autorizado.
- `/bajas/:id/editar`: corrección restringida.
- `/bajas/resumen`: indicadores del módulo.
- `/administracion/catalogos-bajas`: categorías, tipos, productos, presentaciones, unidades, proveedores y motivos.

El menú debe distinguir “BPH” de “Bajas”; evitar llamar “Analytics” a indicadores de módulos diferentes. El acceso a BPH conserva su comportamiento mientras se agregan agrupaciones de navegación. Cada pantalla tendrá título, acción principal, carga, estado vacío, error con reintento y acceso claro para volver.

## 4. Catálogos: autonomía completa de los usuarios autorizados

### 4.1 Qué se configura

Categoría: nombre, orden, estado, etiqueta del tipo (por ejemplo “Tipo de corte” o “Tipo de plato”), si requiere tipo y si requiere proveedor. Las reglas son opciones declarativas limitadas, no código ni expresiones introducidas por usuarios.

Tipo de producto: nombre y categoría. Permite cortes como Filete/Molida/Cubo y otros tipos según categoría. No será un catálogo global de cortes aplicado incorrectamente a comidas o quesos.

Producto: nombre, código interno opcional y único, categoría, tipo cuando corresponda, presentación predeterminada y estado. El tipo es una clasificación y el producto es lo que se registra como baja. No exigir al usuario introducir dos veces la misma información: seleccionar producto completa categoría/tipo; si comienza por categoría/tipo, filtra los productos.

Unidad: nombre singular/plural, abreviatura, admite decimales, precisión permitida y estado. Las unidades por conteo admiten solo enteros. Propuesta inicial: hasta tres decimales para unidades medibles. No habrá conversiones implícitas entre bandejas, porciones, masa o volumen.

Presentación: nombre, producto asociado, unidad de registro, estado y marca predeterminada. Cada producto tiene al menos una presentación activa al habilitarlo. Si tiene una sola, se selecciona automáticamente; si tiene varias, se permite elegir. No representa conversiones de inventario. Crear producto y su presentación inicial será una sola operación para evitar formularios innecesarios.

Proveedor: nombre, código opcional, estado y categorías aplicables. La validación de proveedor obligatorio se toma de la categoría, inicialmente Cárnicos. La lista se filtra por aplicabilidad.

Motivo: nombre, descripción opcional, exige explicación, categorías aplicables u opción “Todas”, orden y estado. “Otro” es una fila configurable con explicación obligatoria, no una condición basada en comparar el texto literal.

Todos estos catálogos tienen alta, edición, búsqueda, filtro de estado, desactivación, restauración e historial. Estados técnicos, roles y permisos no son catálogos libres: permitir añadir un estado o rol sin lógica asociada no sería seguro ni funcional.

### 4.2 Alta desde el formulario

Junto a cada selección de negocio habrá “Agregar…” para administrador y supervisor. Abre un diálogo con los campos correspondientes, hereda el contexto —por ejemplo categoría— y mantiene intacta la baja en preparación. Al guardar, actualiza la lista y selecciona el nuevo elemento automáticamente. “Administrar” permite revisar activos e inactivos.

Un registrador sin permisos ve las selecciones, pero no puede crear por API aunque manipule el navegador. Si no existe una opción, se muestra que debe gestionarla un supervisor; no requerirá soporte técnico.

La creación de un catálogo no se deshace si luego se cancela la baja: son operaciones distintas y ambas deben explicarse claramente cuando corresponda.

### 4.3 Desactivación y restauración

- Etiquetar la acción como “Desactivar”, con explicación de que se oculta para nuevas bajas y conserva el historial.
- Solicitar motivo y mostrar las dependencias afectadas.
- Los inactivos no aparecen para nuevas selecciones; sí en historial, auditoría y filtros históricos.
- Desactivar categoría vuelve no seleccionables sus productos sin modificar masivamente el estado propio de cada hijo. Restaurar la categoría no reactiva hijos desactivados individualmente.
- Desactivar un tipo o unidad con productos/presentaciones activos dependientes se bloquea hasta resolver esas dependencias explícitamente.
- Desactivar proveedor o motivo es posible si no deja categorías obligatorias sin ninguna opción válida; en caso contrario se explica qué opción alternativa crear primero.
- Mantener al menos una presentación activa y una predeterminada válida por producto activo; reasignar la predeterminada en la misma transacción.
- Un valor desactivado en una baja antigua permanece visible como “Inactivo”; corregir observaciones no obliga a sustituir referencias históricas. Si se cambia una referencia, la nueva debe estar activa y ser compatible.
- Si un catálogo queda inactivo mientras otro usuario prepara un registro, el servidor rechaza el envío con mensaje específico y el formulario conserva lo ingresado.
- Restaurar comprueba padres, compatibilidad y duplicados; nunca recupera una fila en silencio por coincidir el nombre.

### 4.4 Identidad y cambios históricos

Identificadores estables independientes del nombre. Normalizar espacios, mayúsculas y Unicode para detectar duplicados; conservar el nombre visible original. No fusionar automáticamente nombres por quitar acentos. La unicidad se aplica en el ámbito correcto: tipo dentro de categoría; presentación dentro de producto; producto según código o nombre normalizado/categoría/tipo. Las restricciones de base deben cubrir carreras concurrentes, incluidos tipos opcionales.

Antes de crear un nombre ya inactivo, ofrecer restaurarlo. Cambiar nombre no cambia identidad. Cambiar categoría de un producto utilizado o alterar la naturaleza/precisión de una unidad utilizada se bloquea: crear una nueva opción y desactivar la anterior. Las correcciones ortográficas sí se permiten y quedan auditadas.

## 5. Modelo de datos y conservación

Nuevas entidades propuestas: `CategoriaProducto`, `TipoProducto`, `Producto`, `UnidadMedida`, `PresentacionProducto`, `Proveedor`, `MotivoBaja`, relaciones de aplicabilidad, `BajaProducto`, `EventoAuditoriaBajas`, `AccesoModulo`.

Cada catálogo incluye identificador, nombre, estado, versión, creadoEn/Por, actualizadoEn/Por y desactivadoEn/Por/motivo. El evento de auditoría conserva todas las transiciones, no solo la última.

Cada baja incluye:

- UUID interno, identificador visible único generado en servidor, sin prometer correlación sin saltos.
- Producto, presentación, unidad, categoría/tipo y proveedor cuando corresponda.
- Cantidad `Decimal` con precisión definida; propuesta `Decimal(14,3)`, validación adicional por unidad y límites operativos explícitos.
- Motivo, explicación cuando sea obligatoria y observaciones con límite.
- Fecha del hecho, fecha de registro del servidor, creador y versión.
- Estado `REGISTRADA` o `ANULADA`; fecha, usuario y motivo de anulación.
- Copia histórica de nombres, unidad, precisión y reglas aplicables al registro; referencias por ID para agrupar y navegar.
- Clave de idempotencia, huella del contenido.
- Motivo del registro retroactivo cuando la fecha del hecho sea anterior al día actual.

Separar fecha operativa del hecho (DATE, sin hora inventada) y fecha/hora de creación del servidor (instante UTC). Por defecto, fecha operativa de hoy en America/La_Paz. El registrador no puede cambiarla y el servidor rechaza fechas distintas de hoy. Supervisor y administrador pueden elegir una fecha anterior, con motivo obligatorio y aviso de registro retroactivo; nunca una fecha futura. No imponer un límite retroactivo arbitrario. La fecha de creación y autoría reales no se modifican. Corregir la fecha operativa exige los mismos permisos, motivo, control de versión y auditoría; los reportes se recalculan según el día del hecho.

Fechas de auditoría como instantes UTC con tipos PostgreSQL adecuados y presentación según America/La_Paz; fecha operativa como DATE, sin convertirla a otro día por zona horaria. Cantidades decimales se transportan como cadenas canónicas para evitar errores binarios; el formulario acepta coma o punto decimal inequívocos, sin aceptar separadores de miles ambiguos. Rechazar NaN, infinito, valores negativos/cero, exponentes no permitidos y exceso de precisión.

Restricciones: claves foráneas con `RESTRICT/NO ACTION` para datos auditables, no cascadas destructivas; cantidad positiva; claves únicas y control de versión. Índices iniciales por fecha/id, producto/fecha, categoría/fecha, creador/fecha, estado/fecha y clave de idempotencia. Ajustarlos a planes de consulta medidos, no agregar índices indiscriminadamente.

No almacenar todos los catálogos ni bajas en una sola columna JSON. JSON se reserva para snapshots/eventos estructurados, con versión de formato y tamaño limitado.

## 6. Permisos y auditoría

Reutilizar usuarios y roles existentes; añadir acceso explícito al módulo. Administrador administra accesos; supervisor no concede privilegios. Conservar compatibilidad de sesiones BPH. Los privilegios se comprueban con usuario activo y permisos actuales del servidor.

Propuesta de capacidades: `bajas.verPropias`, `bajas.verTodas`, `bajas.crear`, `bajas.corregir`, `bajas.anular`, `bajas.exportar`, `bajas.verResumen`, `bajas.catalogosGestionar`, `bajas.auditoriaVer`, `bajas.registrarRetroactiva` y `modulos.accesosGestionar`.

Administrador y supervisor: gestión de catálogos, registro, consulta global, corrección, anulación, reportes y auditoría del módulo. Administrador además gestiona accesos. Ambos pueden registrar bajas retroactivas. Registrador: crear bajas de hoy y consultar únicamente las propias. Este alcance se aplica a listado, detalle, búsquedas y cualquier agregación, sin confiar en el creador enviado por el cliente. Ningún usuario obtiene permisos Bajas solo por poseer un token antiguo de BPH.

Cada creación/corrección/desactivación/restauración/anulación genera una auditoría estructurada: actor, instante servidor, entidad, ID, acción, antes, después, motivo, versión y correlación de solicitud. No guardar tokens, PIN ni secretos. Cambios y evento en la misma transacción: si el evento falla, se revierte la operación. No reutilizar como única garantía el helper actual que silencia errores.

La auditoría no tendrá endpoints de edición o eliminación. Corregir cambia la vista vigente conservando todas las revisiones. Anular requiere motivo y excluye la baja de cantidades efectivas, manteniéndola consultable. Un registro anulado no se edita ni reactiva en esta versión; una nueva baja puede indicar su relación de reemplazo. La inmutabilidad desde la API no equivale a protección frente a un administrador de base; documentar accesos y respaldos sin prometer certificación o inviolabilidad.

## 7. API y reglas de escritura

Mantener `/api/v1`. Rutas de Bajas separadas de Evaluaciones:

- `GET/POST /bajas`, `GET /bajas/:id`, `PATCH /bajas/:id`.
- `POST /bajas/:id/anular`, `GET /bajas/:id/eventos`.
- `GET /bajas/resumen`, `GET /bajas/exportar`, salida imprimible con el mismo contrato.
- Rutas explícitas para categorías, tipos, productos, presentaciones, unidades, proveedores y motivos dentro de `/bajas/catalogos`.
- Para cada catálogo: listar/detalle/crear/editar, `POST /:id/desactivar`, `POST /:id/restaurar` e historial.
- Sin endpoints ni pantallas de importación: el arranque con cero registros es parte del alcance confirmado.

Registrar rutas estáticas antes de parámetros dinámicos. Validar entradas Zod en backend, listas de campos permitidos y mensajes por campo; nunca extender `req.body` directamente sobre columnas sensibles. Los mismos conceptos de validación se reflejan en frontend.

Registro: autenticar → autorizar → validar → comprobar catálogos y reglas → insertar baja y auditoría → confirmar transacción → responder. No usar bloqueo global de toda la tabla de evaluaciones o bajas.

Idempotencia: el cliente genera una clave por intento lógico; doble clic y reintentos usan la misma. La base impone unicidad por usuario/clave. Repetición con mismo contenido devuelve el resultado original; mismo identificador con contenido distinto devuelve conflicto. Validar la huella y no renovar una clave durante un timeout. Dos bajas legítimas del mismo producto y día deben permitirse.

Edición: incluir versión esperada en la condición de actualización; versión obsoleta devuelve 409 y permite revisar los cambios ajenos sin sobrescribirlos. Toda corrección y anulación requiere motivo. Comprobar las carreras entre desactivar catálogo y crear baja mediante transacción y bloqueos o aislamiento limitado a las filas relevantes.

Errores: 400 para formato, 401 sesión, 403 permisos, 404 recurso no visible/inexistente, 409 conflicto, 422 reglas de negocio si se adopta uniformemente, 429 límites y 5xx fallo interno con identificador de seguimiento. No exponer stack ni detalles de conexión.

## 8. Formulario, historial y reportes

Formulario: fecha operativa automática para registrador, editable hacia atrás solo para supervisor/administrador con motivo obligatorio; selección con búsqueda de producto, categoría/tipo como filtros, presentación, cantidad y unidad automática, proveedor condicional, motivo y explicación condicional, observaciones y resumen antes de guardar. Mantener los datos si hay error; éxito solo después de confirmar el servidor. Ofrecer “Registrar otra baja” y “Ver registro”. Crear catálogos desde este flujo no debe reiniciar el formulario.

Los campos seleccionados se invalidan de manera explícita al cambiar su padre. Nunca dejar un proveedor o tipo incompatible invisible. Cargas de selectores dependientes cancelan o ignoran respuestas obsoletas. Avisar al abandonar un formulario con cambios. Borrador de sesión en memoria; no prometer sincronización sin conexión ni guardar una baja como confirmada estando offline.

Historial: fecha desde/hasta, categoría, tipo, producto, presentación/unidad, proveedor, motivo, responsable, estado y búsqueda por identificador/nombre. Filtrar y agrupar por fecha operativa; mostrar también fecha/hora real de registro en detalle y exportación para distinguir cargas retroactivas. Día actual como vista inicial, botón “Todo el historial”, filtros persistidos en URL, limpiar filtros, orden estable por fecha e ID y paginación del servidor. Incluir nombres históricos al buscar, no solo los actuales.

Resumen: número de registros efectivos, anulaciones por separado y cantidades agrupadas por producto y unidad. Desglose por categoría/motivo/proveedor sin mezclar unidades. Un cero real se distingue de una carga fallida. Resumen calcula sobre todos los resultados autorizados, no sobre la página visible.

Excel, CSV e impresión respetan todos los filtros y permisos, con orden definido, rango y fecha de generación. Columnas mínimas: identificador, fecha/hora, categoría/tipo, producto, presentación, proveedor, cantidad, unidad, motivo/explicación, observaciones, responsable, estado. Exportar también inactivos históricos si coinciden con filtros. Anulados identificados y excluidos de totales efectivos. Tratar texto como texto en Excel y neutralizar fórmulas en CSV. Unicode, comillas y saltos de línea deben conservarse. No depender de scripts CDN para exportar. Límites de tamaño explícitos y mensajes antes de exportaciones grandes; no truncar silenciosamente.

## 9. Responsive, accesibilidad y calidad visual

Reutilizar tokens, tipografía, espaciado y componentes de CEPROD. CSS del módulo con alcance propio para no modificar tablas, botones o formularios BPH accidentalmente.

- Verificar anchos 320, 360, 390, 768, 1024 y 1440 px; orientación horizontal y zoom 200%.
- Móvil: formulario en una columna, acciones accesibles, filtros plegables con contador y lista de bajas en tarjetas legibles con acceso a detalles.
- Tablet/escritorio: columnas solo si existe espacio suficiente; tabla con columnas prioritarias y controles visibles. Si hay desplazamiento horizontal, limitarlo al contenedor de tabla, nunca a toda la página.
- Catálogos extensos con búsqueda y carga paginada; no descargar miles de opciones en cada selector.
- Diálogos de alta/edición con altura máxima y scroll interno, sin controles fuera de pantalla al abrir el teclado móvil. Evitar diálogos anidados: usar un solo flujo o panel contextual.
- Objetivo de diseño: controles táctiles de al menos 44×44 px, etiquetas visibles, foco claro, contraste comprobado, estados no basados solo en color.
- Teclado completo, orden de foco lógico, Escape/cancelar, retorno de foco al disparador, contención de foco en diálogo, errores asociados a su campo y anuncio de resultados.
- No bloquear pegado ni teclado decimal; ayuda textual para unidad y precisión. Nombres largos no tapan acciones.
- Impresión con encabezado y filtros, sin navegación ni botones y sin cortar filas deliberadamente cuando pueda evitarse.

Estos son criterios verificables del producto; no se declara conformidad certificada con una norma sin evaluación específica.

## 10. Arranque desde cero y catálogos iniciales

1. Conservar el HTML como referencia funcional. No leer ni importar sus registros o localStorage.
2. Crear las tablas del módulo sin bajas, sin historial ficticio y sin datos de prueba en producción.
3. Cargar únicamente categorías, productos/tipos, presentaciones, unidades, proveedores y motivos iniciales derivados del HTML, verificando las relaciones.
4. Los catálogos precargados se administran igual que los nuevos: crear, editar, desactivar y restaurar con permisos y auditoría.
5. Ejecutar semillas idempotentes: repetir un despliegue no duplica opciones, no sobreescribe cambios del usuario y no restaura inactivos.
6. Mostrar estados vacíos útiles: “Aún no hay bajas” y “Registrar primera baja”; resumen de cero registros sin porcentajes inventados.
7. Crear datos sintéticos solo en el entorno de pruebas, separado de producción y de los registros BPH existentes.
8. Comprobar que comenzar de cero afecta únicamente al nuevo módulo: no limpiar tablas, usuarios, evaluaciones ni bitácoras existentes.
9. No implementar importador, tablas de importación, mapeos legados ni herramientas de recuperación de navegadores.
## 11. Organización del código y escalabilidad

Monolito modular: un despliegue frontend y un backend, con módulos internos. Frontend nuevo bajo `src/modules/bajas/` con páginas, componentes, API, estado y validación. Backend nuevo bajo `src-node/modules/bajas/` con rutas, schemas, servicios, consultas y exportación; montar el router en `app.js`.

Componentes compartidos solo cuando hay reutilización real: selectores con búsqueda, mensajes, diálogos, filtros, paginación y control de permisos. No duplicar formularios por categoría. No construir un motor genérico que permita al usuario ejecutar reglas arbitrarias.

Carga diferida de rutas del módulo, estado separado de evaluaciones y catálogos con invalidación tras cambios. Consultas paginadas, agregaciones en servidor y selección de columnas necesarias. Una base compartida con entidades separadas; categorías de productos no se confunden con áreas de trabajadores o categorías de parámetros BPH.

Nuevos módulos futuros se agregan mediante rutas, permisos y navegación registrados en un punto central. No requieren modificar cada pantalla de BPH. Acceso y auditoría son capacidades comunes; reglas específicas permanecen dentro del módulo.

## 12. Etapas, entregables y puertas de calidad

### Etapa 0 — Cerrar alcance y línea base

Aplicar las decisiones confirmadas de consulta propia/global, registro retroactivo y arranque vacío. Verificar catálogos iniciales y preparar pruebas de volumen variable. Inventariar servicios desplegados, versión activa, configuración y acceso a respaldos sin registrar secretos. Ejecutar pruebas BPH existentes y build; documentar fallos previos. Preparar entorno de pruebas aislado y datos sintéticos.

Salida: decisiones documentadas, contrato de datos, permisos y casos de prueba; ausencia de dudas que cambien el modelo principal. No usar producción para crear pruebas ficticias.

### Etapa 1 — Esquema, auditoría y permisos

Agregar migraciones compatibles, claves/índices, semillas idempotentes, eventos transaccionales y acceso al módulo. Implementar pruebas con PostgreSQL aislado, incluidos rollback y concurrencia. Registrar versión de esquema y estrategia de despliegue compatible con aplicación anterior.

Salida: migración aplicada en copia/entorno de pruebas, reversión de aplicación ensayada, históricos BPH intactos, semillas repetibles y permisos por API verificados.

### Etapa 2 — Catálogos y autogestión

Implementar todas las APIs y pantallas de categoría, tipo, producto/presentación, unidad, proveedor y motivo. Incluir búsqueda, alta contextual, edición, dependencias, inactivos, restauración y auditoría.

Salida: supervisor crea una categoría y un producto completo sin tocar código, lo usa en selector, lo desactiva y restaura; duplicados y carreras controlados. Usuario sin permisos no puede administrar por API.

### Etapa 3 — Registro, corrección y anulación

Construir formulario responsive, detalle, reglas dinámicas, idempotencia, conflictos de versión y estados. Integrar altas contextuales de catálogos.

Salida: baja real de prueba queda persistida con su auditoría, doble envío produce una sola, dos eventos legítimos producen dos; editar exige motivo/versión; anular conserva todo y excluye cantidades efectivas.

### Etapa 4 — Historial, resumen y exportaciones

Implementar filtros compartidos, rangos de fecha, paginación, indicadores, Excel/CSV e impresión, alcance de datos por permiso y búsqueda histórica.

Salida: historial, resumen y exportación coinciden en conjunto y totales; fechas de medianoche correctas; registros inactivos/anulados no desaparecen de consultas históricas pertinentes.

### Etapa 5 — Preparación del arranque vacío

Verificar semillas, relaciones de catálogos, estados vacíos, alta del primer registro y separación entre datos sintéticos de pruebas y producción. Comprobar que despliegues repetidos preservan cambios del usuario.

Salida: cero bajas al habilitar inicialmente el módulo, catálogos editables disponibles, ninguna opción duplicada tras repetir semillas y todos los datos BPH intactos. Las bajas creadas después del arranque se conservan en futuros despliegues.

### Etapa 6 — Verificación integral y piloto

Ejecutar matriz funcional, permisos, integridad, seguridad de entradas/exportaciones, responsive, teclado y navegadores. Probar con usuarios representantes de cada rol. Medir rendimiento con volumen representativo y revisar consultas lentas.

Salida: sin fallos críticos/altos abiertos en guardado, permisos, auditoría o navegación; defectos menores documentados; aceptación de los recorridos operativos y manual breve listo.

### Etapa 7 — Despliegue y observación

Respaldar y verificar restauración previamente. Publicar backend/migraciones compatibles, verificar versión y endpoints; publicar frontend en el Worker CEPROD existente, verificar URL y assets. Habilitar Bajas solo a usuarios piloto al comienzo y ampliar accesos después de comprobación.

Salida: verificación autenticada en producción de rutas y catálogos, registro operativo autorizado si se necesita comprobar escritura, métricas/logs revisados y regresión BPH verificada. Una respuesta de `/health` o un push a GitHub no demuestra por sí solo que la versión requerida está activa.

No se asignan fechas de entrega ficticias: estimar cada etapa tras cerrar decisiones y medir alcance. Cada etapa termina con evidencia y un resumen de cambios, pruebas, limitaciones y siguiente paso.

## 13. Matriz de pruebas obligatoria

Funcional: todas las categorías iniciales y una creada por supervisor; proveedores condicionales; múltiples presentaciones; motivos con/sin explicación; observaciones largas; cambio de categoría y selectores dependientes; alta contextual sin perder formulario.

Catálogos: editar nombres preserva snapshots; desactivar oculta solo nuevas opciones; restaurar respeta estados propios; padres inactivos; unidad/tipo con dependencias; nombre duplicado activo/inactivo; misma alta simultánea; producto sin presentación válida; cambio de regla no reescribe históricos.

Datos: enteros/decimales, coma/punto, exceso de precisión, límites, cero/negativos/NaN; zona horaria cerca de medianoche; orden estable; dos usuarios creando y corrigiendo; catálogo desactivado durante guardado; rollback si falla auditoría.

Idempotencia: doble clic, timeout después de commit, reintento desde la misma pantalla, clave repetida con otro contenido; nueva baja intencional con igual producto/cantidad permitida.

Permisos: sin sesión, sesión vencida, usuario desactivado, acceso módulo retirado, registrador intentando editar/anular/catalogar/exportar, consulta de ID ajeno y filtros que intentan ampliar alcance; supervisor intentando conceder permisos; registrador intentando forzar fechas anteriores o ver registros ajenos; supervisor/administrador registrando fechas anteriores con y sin motivo, y todos intentando fechas futuras.

Reportes: todas las combinaciones principales de filtros; exportación coincide con listado completo y resumen; históricos inactivos y anulaciones; Unicode, comillas y saltos; textos que empiezan con signos interpretables como fórmulas; impresión multipágina.

Arranque: cero bajas y catálogos listos; repetición de semillas sin duplicados, sobrescrituras ni reactivaciones; ausencia de bajas ficticias en producción; primera baja visible; siguientes despliegues conservan todas las bajas y evaluaciones.

Interfaz: móvil/tablet/escritorio, zoom, teclado, foco en diálogos, lector de pantalla en formularios y errores, conexión lenta/interrumpida, selectores vacíos, nombres largos, volumen grande y restauración del estado tras errores.

Regresión BPH: login/logout/recuperación, acceso por rol, evaluación y bloqueo diario, área automática, trabajadores activos/inactivos, dashboard, Excel y bitácora. Revisar cambios en navegación y CSS especialmente.

Pruebas unitarias para reglas puras; integración con base PostgreSQL de pruebas para constraints/transacciones/concurrencia; API para autorización; recorridos de navegador para tareas completas. Las pruebas en memoria existentes no sustituyen la integración de base.

## 14. Operación, respaldo y reversión

Definir con el responsable de infraestructura la frecuencia de respaldo y objetivos de pérdida de datos/recuperación, verificando qué ofrece realmente el proveedor. Ensayar restauración en una base aislada. Excel no sustituye un respaldo de base.

Registrar fallos de guardado, conflictos,  latencia y disponibilidad con correlación; sin secretos ni datos completos innecesarios en logs. Manejar arranques lentos del servicio sin reenvíos duplicados ni falsos éxitos.

Propuesta de rendimiento para pruebas: listados y filtros habituales en menos de dos segundos con servidor caliente y datos representativos; separar medición del arranque en frío. Medir con 10.000 y 100.000 bajas sintéticas, ajustar el volumen a uso esperado. No prometer latencia fija antes de medir infraestructura.

Reversión: deshabilitar acceso al módulo, conservar tablas/eventos y volver a la versión anterior compatible del frontend/backend. No ejecutar una migración destructiva ni borrar bajas como método de rollback. Si hubo corrupción, detener escrituras afectadas y aplicar procedimiento de recuperación ensayado con conciliación posterior.

## 15. Definición de terminado y documentación

Se considera terminado cuando todos los selectores de negocio tienen catálogo administrable, el registrador opera sin soporte, los permisos se aplican en servidor, ninguna desactivación destruye datos, auditoría y operación son atómicas, reportes coinciden, responsive y accesibilidad se han comprobado, arranque vacío verificado y registro retroactivo con permisos/auditoría comprobado y BPH continúa funcionando.

Entregar: migraciones y semillas, pruebas automatizadas, contrato de API, diccionario de campos/reglas, guía corta por rol, guía de catálogos y restauración, guía de registro retroactivo y arranque, evidencias de QA, versión y URL desplegadas, procedimiento de respaldo/reversión y lista de limitaciones reales.

Trazabilidad de requisitos: autonomía de catálogos → etapa 2; bajas/auditoría → etapas 1 y 3; histórico e informes → etapa 4; arranque vacío y catálogos iniciales → etapa 5; responsive/permisos/calidad → todas las etapas y verificación 6; publicación comprobada → etapa 7.

Decisiones operativas cerradas: consulta propia para registradores y global para supervisor/administrador; fechas anteriores solo para supervisor/administrador; cero registros iniciales y sin importación. El volumen diario variable se atiende con búsqueda, filtros por día/rango, paginación del servidor, registro consecutivo sencillo y pruebas de carga sintética. No se necesita una estimación exacta para comenzar. La frecuencia de respaldos y los objetivos de recuperación se concretarán al verificar la infraestructura en la etapa 0.
