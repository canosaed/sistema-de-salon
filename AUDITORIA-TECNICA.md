# Auditoría técnica y funcional

**Fecha:** 10 de noviembre de 2026  
**Evaluación:** **APROBADO PARCIALMENTE**  
**Alcance:** auditoría estática y validación en PostgreSQL local de migraciones, concurrencia, CRUD/persistencia, todas las Server Actions exportadas, reserva pública en navegador, autorización dinámica por rol, ABM de usuarios, flujos autenticados de agenda/pagos/configuración, UI responsive y recuperación ante una interrupción de red simulada. No se modificó una base de producción ni se interrumpió PostgreSQL.

**Decisiones confirmadas:** un solo salón con zona horaria fija `America/Argentina/Buenos_Aires`; bootstrap del primer administrador con token de un solo uso; invitaciones copiables para los roles administrables. Administración tiene acceso total, recepción gestiona agenda/clientes/pagos y profesionales no acceden al panel hasta contar con una vista restringida.

## A. Diagnóstico general

El proyecto utiliza Next.js 16 App Router, React 19, TypeScript, PostgreSQL/Drizzle y Better Auth. Hay páginas para el panel, reservas públicas y autenticación, Server Actions para las principales entidades y un esquema relacional.

Las rutas principales de agenda, reservas, pagos e inventario leen y escriben en PostgreSQL; las reservas públicas e internas guardan sus datos relacionados en transacciones, y la disponibilidad usa datos persistidos. La base local se migró y validó; las pruebas cubren CRUD por SQL, concurrencia, persistencia entre conexiones, las 40 Server Actions exportadas y autorización HTTP por rol. El repositorio en memoria, sus semillas y el `lib/test-runner.ts` sin consumidor activo fueron retirados.

Se añadieron pruebas unitarias, de base de datos, integración de acciones y E2E de roles. El portal público se automatizó con Playwright: el flujo de navegador termina en confirmación y sus datos/servicios/historial se verifican en PostgreSQL; todos los fixtures se limpian. El E2E autenticado cubre reprogramación y cobro desde recepción, configuración del salón desde administración, gestión de usuarios por rol, bloqueo/reactivación y revocación de sesiones, campos obligatorios y estado vacío de clientes, además de navegación móvil sin desbordamiento. Una prueba usa un proxy TCP local para simular una interrupción y restauración de conectividad en el mismo pool de aplicación, sin detener PostgreSQL. El contador de visitas ahora se recalcula de forma transaccional al completar, revertir o cancelar un turno. El panel permite desplegar el historial de turnos y eventos por cliente. La fecha del panel y de las reservas usa la zona horaria fija del salón. Se eliminaron tanto el endpoint GET `/api/tests` como el repositorio de pruebas en memoria.

## B. Resultado de auditoría por módulo

| Módulo | Estado | Observaciones |
|---|---|---|
| Repositorio / CRUD | **Verificado parcialmente** | Las entidades principales tienen cobertura CRUD directa contra PostgreSQL; se retiraron el repositorio y las semillas legadas sin consumidores activos. |
| Server Actions | **Verificado parcialmente** | `pnpm test:actions` invoca las 40 acciones exportadas contra PostgreSQL real, cubriendo lecturas, CRUD, agenda, pagos, stock, configuración, usuarios, invitaciones y reserva; el helper de sesión se simula en esa suite. El E2E HTTP de roles cubre con sesiones reales completar/reprogramar/cobrar desde recepción, cambiar configuración y administrar cuentas desde administración, con verificaciones de persistencia en PostgreSQL. No equivale a probar todas las acciones privilegiadas. |
| Clientes | **Verificado parcialmente** | CRUD y lectura usan PostgreSQL; la prueba DB crea, lee, actualiza y elimina un cliente temporal, y verifica persistencia desde otra conexión. El contador de visitas y el historial de turnos/eventos se muestran en el directorio. |
| Profesionales | **Verificado parcialmente** | CRUD de profesional y horarios, asignaciones, ausencias y bloqueos probado vía PostgreSQL; E2E autenticado crea/edita una profesional y administra un horario. Bajas HTTP no cubiertas en su totalidad. |
| Servicios y categorías | **Verificado parcialmente** | CRUD de categoría, servicio y técnica probado vía PostgreSQL; E2E autenticado crea y edita un servicio. Las bajas y demás combinaciones de formularios siguen pendientes. |
| Agenda y turnos internos | **Verificado** | La prueba de concurrencia real rechaza una reserva superpuesta con SQLSTATE `23P01`; el trigger y el índice parcial están activos. |
| Reservas públicas | **Verificado** | Playwright completa el formulario real del portal, confirma la reserva y comprueba en PostgreSQL el estado, precio, seña y detalle/historial; fixtures se eliminan al terminar. |
| Pagos | **Verificado parcialmente** | CRUD de pago y flujo de cobro desde la UI con sesión HTTP real de recepción; PostgreSQL confirma importe, estado y turno. Devoluciones y otros escenarios aún no tienen E2E completo. |
| Inventario | **Verificado parcialmente** | E2E autenticado crea/edita un material y registra un ingreso; PostgreSQL confirma el saldo y el movimiento. Las bajas y otros tipos de movimiento no se cubren todos desde la interfaz. |
| Persistencia | **Verificada** | CRUD comprobado desde una conexión nueva; tras reiniciar Next local, las pruebas HTTP pasaron. Preflight final: 8 turnos, 1 usuario, 4 sesiones y 0 pares activos superpuestos. |
| Integridad relacional | **Parcial** | Las tablas/campos existentes coinciden con el snapshot base; cinco migraciones registradas, incluida la de estado de cuenta. El trigger y el índice parcial de solapamientos están activos. Las claves foráneas operativas y la migración legacy no están cubiertas por el journal estándar. |
| Seguridad / permisos | **Verificado parcialmente** | E2E HTTP valida admin, recepción y profesional: admin accede a equipo/inventario, recepción queda limitada y profesional es redirigido a `/no-access`. No es una auditoría de seguridad exhaustiva. |
| Offline | **No integrado** | Hay utilidades IndexedDB aisladas, pero no se verificó un ciclo real de encolado, replay, resolución de conflictos y confirmación de persistencia. |
| UX móvil / errores | **Parcial** | Reserva pública y panel autenticado probados en Chromium a 390 px, sin desbordamiento horizontal; el formulario/estado vacío de clientes se verifica en móvil y el panel también a 1280 px. La recuperación de conectividad se cubre mediante proxy TCP; no se probaron reinicios ni fallos de almacenamiento PostgreSQL. |

## C. Persistencia

Se verificó `atelier_beauty` en PostgreSQL local: el esquema coincide con el snapshot base (sin columnas faltantes, extras o diferencias de tipo/nullability), el historial Drizzle contiene 5 entradas y el último preflight muestra 8 turnos, 1 usuario, 4 sesiones y 0 pares activos superpuestos. Siete turnos corresponden al estado previo y a los tres fixtures de desarrollo solicitados; el octavo es una reserva local adicional con datos que no coinciden con los prefijos de pruebas automatizadas. Se inspeccionó y se conservó sin modificar ni borrar, ya que no corresponde a una fixture identificable. El trigger e índice de solapamientos están activos.

Se ejecutó una reserva online temporal con Chromium contra el servidor local: el flujo recorrió catálogo, selección de profesional/fecha/horario, datos, aceptación de políticas y confirmación. Se verificaron precio/seña, una fila de `appointment_service` y una de `appointment_history`; servicio, profesional, turno, clienta y fixtures se eliminaron después. Las pruebas CRUD/concurrencia, Server Actions y E2E de roles también limpian sus registros temporales. Además, se cargaron por pedido del usuario fixtures persistentes `dev-demo-` para desarrollo. La reserva local adicional identificada no se modificó:

- Las reservas públicas e internas, los pagos y los movimientos de inventario se agrupan en transacciones.
- Las reservas guardan el detalle de servicios/técnicas en `appointment_service` y una instantánea histórica.
- La prueba CRUD opera directamente con SQL sobre categorías, servicios, técnicas, profesionales, horarios, asignaciones, ausencias, bloqueos, clientes, turnos, detalle/historial, pagos, materiales, movimientos e invitaciones; una conexión nueva observa los datos confirmados y la prueba limpia sus fixtures. No cubre cada acción HTTP ni simula fallos abruptos de PostgreSQL.
- `scripts/server-actions.integration.test.ts` llama todas las acciones exportadas en `app/actions/` con PostgreSQL real. El helper de sesión está sustituido para establecer los roles de prueba; las rutas HTTP de rol se validan en una prueba separada.
- `scripts/public-booking.e2e.ts` ejecuta la interfaz real con Playwright/Chromium y confirma la persistencia, incluido el desglose histórico. No se reinició PostgreSQL: las pruebas no lo necesitaron y todas las escrituras fueron temporales.
- El esquema Drizzle no declara claves foráneas para las relaciones operativas.
- `drizzle/0001_reconcile_legacy_neon.sql` no aparece entre las entradas de `drizzle/meta/_journal.json` y no se ejecutó. No se debe asumir que `db:migrate` la aplique.
- `db:migrate:safe` comparó el esquema local con el snapshot y registró como existentes las migraciones base antes de aplicar `0002` y `0003`; no se ejecutó el baseline sobre tablas con datos.

## D. Errores detectados

### 1. El repositorio anunciado como persistente es sólo memoria — bloqueante

- **Causa raíz:** `SalonRepository` inicializa colecciones con datos semilla y sus métodos CRUD mutan arrays; el singleton es sólo del proceso.
- **Archivos:** `lib/db/salon-repository.ts`, `lib/db/seed-data.ts`.
- **Impacto:** datos que no se guarden también en DB se pierden al reiniciar o cambiar de instancia; distintos procesos pueden observar agendas distintas.
- **Corrección aplicada:** se retiró el repositorio en memoria de los flujos principales y también el código legado no utilizado (`lib/test-runner.ts`, `lib/db/salon-repository.ts`, `lib/db/seed-data.ts`).
- **Nueva prueba:** CRUD PostgreSQL temporal y visibilidad desde una conexión nueva; además, el build y las pruebas pasaron sin referencias a las semillas ni al repositorio en memoria.

### 2. Disponibilidad pública desconectada del catálogo y agenda persistidos — bloqueante

- **Causa raíz inicial:** `checkPublicAvailability` y `createPublicBooking` consultaban disponibilidad en memoria mientras el catálogo podía venir de PostgreSQL.
- **Impacto:** un servicio real con ID no presente en las semillas puede no producir disponibilidad; cuando coinciden los IDs, duración/precio/agenda pueden seguir siendo obsoletos. La disponibilidad no es una fuente única con la administración.
- **Corrección aplicada:** catálogo, horarios, asignaciones, ausencias, bloqueos y turnos se consultan desde PostgreSQL; la reserva y su detalle histórico se escriben en una transacción.
- **Nueva prueba:** `pnpm test:e2e:public` recorre el flujo en navegador local, comprueba los datos persistidos y limpia sus fixtures.

### 3. No se garantiza la exclusión de turnos superpuestos en persistencia — bloqueante

- **Causa raíz inicial:** comprobar conflictos y luego insertar no es atómico. La reserva pública no usaba transacción ni bloqueo de concurrencia. El preflight encontró el índice parcial ausente, aunque el trigger sí estaba activo.
- **Impacto:** dos peticiones concurrentes —incluida una interna frente a una pública— pueden aceptar horarios incompatibles.
- **Corrección aplicada:** trigger SQL para impedir solapamientos; las acciones de reserva/reprogramación usan bloqueo transaccional. `db:migrate:safe` ahora recupera y verifica el índice parcial faltante de forma concurrente.
- **Nueva prueba:** dos conexiones reales; la segunda esperó el advisory lock y fue rechazada con SQLSTATE `23P01`. Preflight final confirmó trigger e índice.

### 4. Autenticación sin autorización de rol/propietario — alto

- **Causa raíz:** las Server Actions administrativas normalmente exigen una sesión, pero no comprueban `user.role` ni una relación de pertenencia al salón. El registro permite crear cuentas y el esquema asigna el rol `receptionist` por defecto. Varias consultas de servicios, profesionales, materiales, pagos y turnos no están limitadas al usuario/salón.
- **Impacto:** una cuenta autenticada no queda aislada de operaciones administrativas ni de datos de otros salones; la política de acceso del negocio no está definida ni aplicada.
- **Corrección aplicada:** helper de autorización compartido; admin tiene acceso total, recepción puede gestionar agenda/clientes/pagos, las invitaciones solo crean cuentas de recepción y profesionales no pueden acceder al panel. Página, consultas y Server Actions protegidas según rol.
- **Nueva prueba:** E2E HTTP para admin, recepción y profesional. Se verificaron visibilidad y acceso a rutas restringidas, incluyendo redirección del profesional a `/no-access`.

### 5. Escrituras compuestas sin transacciones — alto

- **Causa raíz:** altas internas, reservas, pagos y movimientos de inventario realizan varias escrituras independientes. Una falla intermedia puede dejar cliente, turno, historial, pago o stock parcialmente actualizados.
- **Archivos:** `app/actions/booking.ts`, `app/actions/dashboard.ts`, `app/actions/inventory.ts`.
- **Corrección aplicada:** reserva pública/interna, pago y actualización de inventario usan transacciones para mantener atómicas sus escrituras relacionadas.
- **Nueva prueba:** CRUD temporal directo contra PostgreSQL para pagos, inventario y entidades relacionadas; no sustituye pruebas de cada Server Action ante fallos.

### 6. Reprogramación sin validar agenda persistida de forma atómica — alto

- **Causa raíz inicial:** la acción no validaba de forma transaccional los conflictos de la agenda persistida.
- **Archivo:** `app/actions/dashboard.ts`.
- **Impacto:** sin la migración de protección SQL, escrituras externas concurrentes podrían producir superposiciones.
- **Corrección aplicada:** validación de horarios, bloqueos, ausencias y turnos desde PostgreSQL dentro de la transacción, con bloqueo de agenda.
- **Nueva prueba:** la migración está aplicada y la protección pasó la prueba concurrente real en PostgreSQL.

### 7. Suite de escenarios no valida el sistema real — alto

- **Causa raíz:** los escenarios llaman al repositorio en memoria; algunos simulan cola offline/conflictos mediante objetos locales. No hay assertions de DB, integración, reinicio, browser o concurrencia real. El endpoint GET de pruebas ejecuta escenarios con efectos sobre el singleton en memoria.
- **Archivos:** `lib/test-runner.ts`, `app/api/tests/route.ts`.
- **Impacto:** respuestas exitosas del endpoint no demuestran que la aplicación persista datos ni que cumpla las reglas bajo concurrencia.
- **Corrección aplicada:** se eliminaron `app/api/tests/route.ts`, el runner de escenarios sin consumidor y el repositorio en memoria; las pruebas activas usan `node:test` y PostgreSQL.
- **Nueva prueba:** `pnpm test` ejecuta 8 pruebas unitarias; `pnpm test:db` ejecuta pruebas de CRUD/persistencia y concurrencia. Los E2E de roles y de reserva pública están automatizados.

### 8. Historial de servicios del turno no se guarda — alto

- **Causa raíz:** las tablas permiten registrar los servicios contratados e información histórica, pero las acciones de reserva revisadas no insertan filas en `appointment_service`.
- **Impacto:** no queda un desglose durable de servicios/técnicas, orden, precio y duración originales; el dashboard puede mostrar una etiqueta genérica en lugar del detalle.
- **Corrección aplicada:** las acciones de reserva pública e interna insertan filas en `appointment_service`, con servicio, técnica, precio, duración y secuencia históricos.
- **Nueva prueba:** `pnpm test:e2e:public` verifica desde la interfaz la reserva confirmada y en PostgreSQL su detalle e historial.

## E. Pruebas realizadas

| Prueba | Resultado | Evidencia |
|---|---|---|
| Inspección PostgreSQL (`pnpm db:preflight`) | **Aprobada** | `atelier_beauty` local: esquema compatible, 8 turnos (3 fixtures `dev-demo-`, 4 preexistentes y 1 reserva local adicional preservada), 0 solapamientos activos y 5 migraciones registradas; trigger e índice parcial activos. |
| Migraciones (`pnpm db:migrate:safe`) | **Aprobadas** | Baseline existente registrado tras validar columnas/tipos/constraints; migraciones `0002` a `0004` registradas. La última agrega estado de cuenta reversible; postcondiciones verificadas en PostgreSQL local. |
| Prueba concurrente (`pnpm test:db`) | **Aprobada** | Dos conexiones concurrentes: la segunda espera el advisory lock y recibe SQLSTATE `23P01`; los registros temporales se eliminan. |
| CRUD / persistencia DB (`pnpm test:db`) | **Aprobada** | CRUD directo vía SQL de entidades principales; los datos confirmados se leen desde una conexión nueva y luego se limpian. |
| Server Actions (`pnpm test:actions`) | **Aprobada** | Las 40 acciones exportadas se invocaron contra PostgreSQL local; los cambios temporales se verificaron y limpiaron. La sesión se simula en el límite de autenticación. |
| Reserva pública browser E2E (`pnpm test:e2e:public`) | **Aprobada** | Playwright/Chromium: catálogo → profesional/fecha/horario → datos/políticas → confirmación; se verificaron reserva, seña, detalle e historial en PostgreSQL y se limpiaron fixtures. |
| Catálogo público dinámico | **Aprobado** | `/reservar` se sirve dinámicamente para reflejar categorías/servicios vigentes de PostgreSQL; el E2E confirma un servicio insertado temporalmente antes de cargar la página. |
| Pruebas unitarias | **Aprobadas** | `pnpm test`: 8 pruebas aprobadas, 0 fallidas; incluye límite de fecha de Argentina respecto de UTC. |
| Contador de visitas | **Aprobado** | `pnpm test:actions` verifica que completar un turno suma una visita, repetir la acción no duplica el conteo y revertir o cancelar el turno la descuenta. |
| Historial de cliente en dashboard | **Aprobado** | `pnpm test:actions` comprueba que los eventos devueltos por PostgreSQL aparecen asociados al turno en los datos del panel; la compilación incluye la vista expandible en el directorio. |
| Flujos privilegiados con sesión HTTP real | **Aprobados parcialmente** | `pnpm test:e2e:roles` usa cookies obtenidas mediante registro/invitaciones reales en Chromium; recepción reprograma, cobra y completa un turno; administración modifica configuración e invita/edita/bloquea/reactiva usuarios. PostgreSQL confirma fecha/hora, pago, estado, visitas, actor, roles, estado y sesiones revocadas. |
| CRUD administrativo desde UI autenticada | **Aprobado parcialmente** | Con sesión real de admin se crean/editan servicios, profesionales y materiales; se crea y activa/desactiva un horario profesional y se registra un movimiento de inventario. Los cambios se verifican en PostgreSQL y se limpian. No cubre aún todas las operaciones de baja de cada módulo. |
| Administración de usuarios | **Aprobada** | `/equipo` lista cuentas, permite invitar con los tres roles, editar nombre/rol y bloquear/reactivar. Bloquear impide iniciar sesión y revoca sesiones; cambiar el rol también revoca sesiones. Se prohíbe auto-bloqueo, auto-democión y quitar o bloquear al último administrador activo. |
| Formularios y estados vacíos | **Aprobados parcialmente** | El E2E comprueba campos obligatorios y estado vacío “No se encontraron clientas.” en el flujo de clientes; se ejercita el formulario a viewport móvil. |
| Panel autenticado responsive | **Aprobado** | `pnpm test:e2e:roles` recorre Reservas y Clientes a 390 px sin desbordamiento horizontal; también comprueba la interfaz a 1280 px. |
| Fallo y recuperación de conectividad DB (`pnpm test:db:failure`) | **Aprobado con alcance acotado** | Un proxy TCP local rechaza conexiones inicialmente y luego reenvía al PostgreSQL local; la acción reporta el fallo y el mismo proceso/pool vuelve a cargar el catálogo. No se detuvo PostgreSQL ni se probó una falla de almacenamiento. |
| Compilación (`pnpm build`) | **Aprobada** | Next.js, TypeScript y generación estática completados. |
| Autorización dinámica de roles | **Aprobada** | `pnpm test:e2e:roles`: admin, recepción y profesional; las rutas/páginas respetan los permisos y una acción privilegiada de recepción se ejecuta con sesión HTTP real. Los fixtures se limpiaron. |
| Reinicio / persistencia | **Aprobada parcialmente** | Se reinició Next local y las suites autenticadas/públicas repitieron correctamente; el conteo de turnos se mantuvo en 8 tras finalizar las pruebas, indicando limpieza de la fixture temporal. No se reinició la instancia PostgreSQL ni se simularon fallos de almacenamiento. |

Las escrituras contra PostgreSQL fueron limitadas a migraciones autorizadas, datos demo `dev-demo-` solicitados por el usuario y fixtures temporales en `localhost`. La base local contiene 8 turnos (4 preexistentes, 3 demos y 1 reserva local adicional preservada); las suites E2E y de concurrencia se repitieron y limpiaron sus registros temporales sin cambiar ese conteo.

## F. Pendientes

1. Completar E2E autenticados de bajas y validaciones de formularios/estados vacíos restantes para cada módulo y viewport; la cobertura actual valida flujos representativos de altas/ediciones y formularios de clientes.
2. Si se requiere certificar tolerancia a fallos de infraestructura, probar en un entorno dedicado reinicio de PostgreSQL y fallos de almacenamiento; la prueba actual solo simula la pérdida/restauración de conectividad TCP y no interrumpe el servidor.

## G. Evaluación final

**APROBADO PARCIALMENTE.** La base PostgreSQL local coincide con el esquema esperado y contiene los fixtures demo solicitados; se verificaron migraciones, CRUD, concurrencia real, las 40 Server Actions, el contador e historial de visitas, fecha del salón, permisos HTTP por rol, flujos autenticados de agenda/pagos, configuración, gestión de usuarios y operaciones representativas de catálogo/profesionales/inventario. Se verificaron formularios y estado vacío de clientes, responsive a 390 px y 1280 px, reserva pública dinámica y recuperación del pool ante una interrupción TCP aislada. Quedan E2E de bajas y validaciones restantes, y pruebas de reinicio/falla de infraestructura en entorno dedicado; esta evidencia no certifica el sistema entero ni una base de producción.

**Cambios de código aplicados:** fuente DB para operaciones principales; reservas y turnos con transacciones y detalle histórico; consultas transaccionales serializadas para evitar consultas paralelas en una misma conexión; trigger de protección de solapamientos; registro con token inicial/invitación; permisos por rol; inventario y pagos transaccionales; contador de visitas sincronizado e historial visible por cliente; fecha local del salón calculada con `America/Argentina/Buenos_Aires`; eliminación del endpoint mutante y del repositorio de pruebas en memoria; cobertura automatizada de las acciones y E2E de reserva pública; scripts de preflight, migración segura y fixtures locales.

## H. Base de desarrollo

Se agregó `pnpm db:seed:dev` para cargar un conjunto ficticio e idempotente sobre PostgreSQL local, y `pnpm db:setup:dev` para migrar una base nueva y luego cargarlo. La ejecución requiere `SALON_ALLOW_DEV_SEED=1`; los datos están identificados por `dev-demo-`, no incluyen usuarios ni credenciales y no reemplazan la configuración existente del salón. El procedimiento, contenido y límites están documentados en [docs/DESARROLLO-BASE-DE-DATOS.md](./docs/DESARROLLO-BASE-DE-DATOS.md).
