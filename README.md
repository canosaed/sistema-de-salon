# Atelier Beauty Studio — Sistema Web de Gestión de Turnos

Sistema web integral, profesional y modular para la administración completa de un salón de belleza especializado en manicuría, pedicuría, uñas esculpidas y pestañas.

La plataforma cuenta con un **panel de administración centralizado** para el equipo del salón y un **portal público de reservas online** para que los clientes agenden turnos directamente desde sus celulares o computadoras sin necesidad de comunicarse previamente con el establecimiento.

---

## 🌟 Características Principales

### 1. Panel de Administración y Gestión Interna (`/`)
- **Dashboard / Resumen:** Indicadores actualizados en tiempo real: turnos de hoy, turnos pendientes de confirmación, base de clientas registradas, ingresos totales en Pesos Argentinos (ARS) y servicios más solicitados.
- **Agenda y Calendario:** Visualización en tres modalidades (diaria, semanal y mensual), filtros por profesional asignada y estado del turno (`pending_confirmation`, `confirmed`, `in_progress`, `completed`, `cancelled`), acciones directas para iniciar, finalizar, reprogramar o cancelar turnos con registro de motivo.
- **Gestión de Reservas Internas:** Flujo ágil para crear turnos manuales seleccionando clienta existente o nueva, servicios, técnicas adicionales, profesional responsable, cálculo secuencial de tiempos y registro de señas inmediatas.
- **Directorio de Clientas:** Búsqueda en tiempo real por nombre o teléfono, conteo de visitas e historial de observaciones y preferencias.
- **Catálogo de Servicios y Técnicas:** Configuración de servicios agrupados por categorías (Manos, Pies, Pestañas), duraciones netas, tiempos de preparación y limpieza (desinfección), precios en ARS, políticas de cancelación y tipos de seña (fija o porcentual).
- **Gestión de Profesionales:** Administración del equipo de especialistas, horarios laborales, descansos intermedios y ausencias programadas.
- **Finanzas y Pagos:** Registro de señas, pagos parciales, pagos completos y devoluciones (reembolsos) en efectivo, transferencia bancaria o tarjeta.
- **Control de Inventario Básico:** Monitoreo de stock de materiales e insumos, registro de movimientos (ingresos, consumos, ajustes, mermas) y alertas automáticas ante stock crítico inferior al mínimo.
- **Reportes:** Consolidado de turnos finalizados, cancelaciones e ingresos del período.
- **Sincronización Híbrida y Modo Offline:** Almacenamiento local mediante IndexedDB con cola de operaciones pendientes y detección de conectividad (`online`/`offline`), manteniendo la nube como fuente de verdad.

### 2. Portal Público de Reservas Online (`/reservar`)
- **Experiencia móvil optimizada:** Flujo intuitivo paso a paso sin requerir registro previo obligatorio:
  1. **Selección de Servicio:** Filtrado dinámico por categoría (Manos, Pies, Pestañas) con descripción, duración estimada y precio en ARS.
  2. **Técnica, Profesional y Horario:** Selección de técnica adicional (nail art, refuerzo, botox), elección de profesional específica o "Cualquier profesional disponible", y consulta de turnos libres en tiempo real (excluyendo turnos ocupados y descansos).
  3. **Tus Datos:** Registro de nombre, apellido, teléfono (asociación automática de ficha existente) y aceptación expresa de las políticas de reserva y cancelación.
  4. **Confirmación y Seña:** Emisión de comprobante digital con resumen del turno, detalle de la seña requerida en ARS e instrucciones para abonar mediante transferencia o billetera digital.

---

## 🛠️ Stack Tecnológico

- **Frontend:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack) & [React 19](https://react.dev/)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **Estilos:** [Tailwind CSS v4](https://tailwindcss.com/) & [Lucide Icons](https://lucide.dev/)
- **Base de Datos y ORM:** PostgreSQL con [Drizzle ORM](https://orm.drizzle.team/) & [drizzle-kit](https://orm.drizzle.team/kit-docs/overview)
- **Autenticación:** [Better Auth](https://www.better-auth.com/)
- **Almacenamiento Local / Offline:** IndexedDB (`lib/offline-sync.ts`)
- **Gestor de Paquetes:** [pnpm](https://pnpm.io/) (versión 10+ o 12)

---

## 🚀 Instrucciones para Ejecutar el Proyecto

### Requisitos Previos

1. **Node.js:** Versión 18+ o superior (probado en Node.js v22).
2. **pnpm:** Versión 9+ o 12 (`corepack enable` o `npm install -g pnpm`).
3. **PostgreSQL:** Instancia local o servicio en la nube (Neon, Supabase, Railway o Docker).

---

### 1. Clonar el Repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd <NOMBRE_DEL_DIRECTORIO>
```

---

### 2. Variables de Entorno

Crear un archivo `.env` o `.env.local` en la raíz del proyecto basándose en las siguientes variables requeridas:

```env
# URL base de la aplicación
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Secreto para sesiones y tokens de Better Auth (mínimo 32 caracteres recomendados)
BETTER_AUTH_SECRET=un_secreto_seguro_para_better_auth_1234567890

# Token inicial de un solo uso para provisionar la primera cuenta administradora (mínimo 32 caracteres)
SALON_SETUP_TOKEN=reemplazar_por_un_token_aleatorio_de_32_caracteres_o_mas

# Conexión a Base de Datos PostgreSQL
DATABASE_URL=postgresql://usuario:password@localhost:5432/atelier_beauty
```

---

## 🗄️ Implementación de la Base de Datos y Migraciones

La persistencia del sistema está diseñada sobre **PostgreSQL** mediante **Drizzle ORM**, implementando modelos relacionales fuertemente tipados con soporte de migraciones versionadas y Drizzle Kit.

### 1. Levantar PostgreSQL (Opciones disponibles)

#### Opción A: Usando Docker (Recomendada para desarrollo local rápido)
Si dispones de Docker, puedes crear un contenedor PostgreSQL en un solo comando:

```bash
docker run --name atelier-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=atelier_beauty \
  -p 5432:5432 -d postgres:16-alpine
```

En este caso, tu `DATABASE_URL` será:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atelier_beauty
```

#### Opción B: Base de datos Cloud (Serverless)
Puedes utilizar cualquier proveedor PostgreSQL compatible con conexión directa o Connection Pooling:
- [Neon](https://neon.tech/)
- [Supabase](https://supabase.com/)
- [Railway](https://railway.app/)

Copia la cadena de conexión proporcionada por el servicio a tu variable `DATABASE_URL` en `.env`.

---

### 2. Comandos de Migración con Drizzle ORM

El proyecto cuenta con scripts configurados en `package.json` para gestionar el ciclo de vida del esquema:

| Comando | Acción | Descripción |
|---|---|---|
| `pnpm db:generate` | **Generar migración** | Analiza `lib/db/schema.ts` y genera los archivos de migración `.sql` en `./drizzle`. |
| `pnpm db:migrate` | **Aplicar migraciones** | Ejecuta las migraciones pendientes sobre la base de datos configurada en `DATABASE_URL`. |
| `pnpm db:preflight` | **Inspección de solo lectura** | Informa base conectada, compatibilidad del esquema, migraciones y guardia de solapamientos, sin cambiar datos. |
| `pnpm db:migrate:safe` | **Migrar un esquema existente** | Solo reconcilia el baseline si las tablas/columnas coinciden con el snapshot y no hay turnos activos superpuestos; después aplica migraciones pendientes y verifica/repara el índice parcial de turnos activos. |
| `pnpm db:push` | **Sincronización directa** | Aplica los cambios de esquema directamente sobre PostgreSQL sin generar archivos SQL (ideal para prototipado rápido). |
| `pnpm db:studio` | **Drizzle Studio** | Abre una interfaz visual web interactiva en el navegador para explorar y editar los datos de las tablas. |

#### Pasos para inicializar el esquema en PostgreSQL:

1. **Generar los archivos de migración:**
   ```bash
   pnpm db:generate
   ```
   Esto creará los archivos de migración en la carpeta `drizzle/` (por ejemplo `0000_fixed_randall_flagg.sql`) que contienen la definición de las 21 tablas relacionales, columnas y tipos.

2. **Aplicar las migraciones a la base de datos:**
   ```bash
   pnpm db:migrate
   ```
   O para sincronización inmediata:
   ```bash
   pnpm db:push
   ```

Antes de migrar una base existente, inspeccioná el destino:

```bash
pnpm db:preflight
```

Si la base ya tiene las tablas del baseline pero carece del historial Drizzle, usá `pnpm db:migrate:safe` en lugar de `pnpm db:migrate`. El comando verifica el snapshot, las restricciones básicas y que no existan turnos activos superpuestos antes de registrar el baseline. Si el esquema no coincide, se detiene sin aplicar migraciones. No uses `db:push` para reconciliar una base existente sin revisar el diff.

Para preparar una base local nueva con datos ficticios de desarrollo, consulta [Base de datos local para desarrollo](./docs/DESARROLLO-BASE-DE-DATOS.md). El proceso requiere habilitación explícita y solo acepta una conexión PostgreSQL local.

3. **Explorar las tablas con Drizzle Studio:**
   ```bash
   pnpm db:studio
   ```
   Abrirá Drizzle Studio en [https://local.drizzle.studio](https://local.drizzle.studio) conectado a tu base de datos.

---

### 3. Instalación de Dependencias

Ejecutar en la raíz del proyecto:

```bash
pnpm install
```

---

### 4. Ejecución en Modo Desarrollo

Para iniciar el servidor de desarrollo local con recarga rápida (HMR):

```bash
pnpm dev
```

La aplicación estará accesible en:
- **Panel Administrativo:** [http://localhost:3000](http://localhost:3000)
- **Portal de Reservas Online:** [http://localhost:3000/reservar](http://localhost:3000/reservar)
- **Inicio de Sesión:** [http://localhost:3000/sign-in](http://localhost:3000/sign-in)
- **Registro:** [http://localhost:3000/sign-up](http://localhost:3000/sign-up)

---

### 5. Compilación y Ejecución en Producción

Para compilar la aplicación para producción:

```bash
pnpm build
```

Para iniciar el servidor optimizado de producción:

```bash
pnpm start
```

---

### 6. Pruebas automatizadas disponibles

Las pruebas unitarias cubren reglas puras de duración/precio, disponibilidad, colisiones, saldos y permisos:

```bash
pnpm test
```

Las pruebas PostgreSQL de CRUD/persistencia y concurrencia requieren `SALON_RUN_DB_TESTS=1` y están restringidas a un servidor local. Crean fixtures temporales y los eliminan al terminar:

```powershell
$env:SALON_RUN_DB_TESTS = "1"
pnpm test:db
```

La integración de Server Actions ejercita todas las acciones exportadas contra PostgreSQL local real; solo sustituye el límite de sesión/autorización para comprobar permisos de admin y recepción. También crea y limpia registros temporales:

```powershell
$env:SALON_RUN_DB_TESTS = "1"
pnpm test:actions
```

Para el E2E completo del portal público (navegador → disponibilidad → formulario → confirmación → filas persistidas) instalá Chromium una vez, iniciá Next local y ejecutá la prueba:

```powershell
pnpm exec playwright install chromium
pnpm dev --hostname 127.0.0.1 --port 3000
```

En otra terminal:

```powershell
$env:SALON_RUN_DB_TESTS = "1"
pnpm test:e2e:public
```

La prueba usa una fixture aleatoria, verifica el turno, la seña, el detalle histórico y la confirmación en PostgreSQL, y limpia sus datos incluso si falla.

La prueba dinámica HTTP de roles requiere iniciar el servidor local de E2E y ejecutar:

```powershell
$env:SALON_RUN_DB_TESTS = "1"
pnpm test:e2e:roles
```

Verifica el acceso de admin, recepción y profesional. Para reiniciar el servidor durante una prueba de persistencia, detené únicamente el PID que escucha en el puerto local de E2E y volvé a iniciarlo. No uses estas pruebas sobre una base compartida o de producción.

Las fixtures para comprobar manualmente el flujo público de reservas pueden prepararse y limpiarse así:

```powershell
$env:SALON_RUN_DB_TESTS = "1"
pnpm e2e:fixtures setup
# Usá el runId informado para reservar desde /reservar en el servidor local.
pnpm e2e:fixtures cleanup <runId>
Remove-Item Env:SALON_RUN_DB_TESTS
```

La limpieza debe ejecutarse incluso si se interrumpe la prueba. No uses estas fixtures en una base compartida o de producción.

### 7. Acceso del equipo

El alta pública de cuentas está protegida: provisiona la primera cuenta administradora con `SALON_SETUP_TOKEN`. Después, una cuenta administradora puede generar enlaces de invitación de un solo uso desde `/equipo`; cada invitación vence en 24 horas y se restringe al correo indicado. Configura `NEXT_PUBLIC_APP_URL` con el origen público de la aplicación para que los enlaces generados sean correctos.

En **Usuarios y equipo**, administración puede invitar con cualquiera de los roles, editar nombre/rol y bloquear o reactivar cuentas. Un bloqueo impide iniciar sesión, revoca las sesiones existentes y es reversible; no elimina la cuenta ni su historial. No se permite bloquear la propia cuenta ni quitar el rol al último administrador activo. Los cambios de rol también revocan las sesiones para que los nuevos permisos se apliquen al volver a ingresar.

Administración conserva acceso total; recepción puede gestionar agenda, clientas y pagos. Las cuentas con rol **Profesional** no tienen acceso al panel actual hasta que exista una vista restringida. Las Server Actions vuelven a verificar que la cuenta esté activa y tenga el rol permitido; ocultar secciones en la interfaz no sustituye ese control.

La agenda actualmente interpreta las horas del salón en la zona `America/Argentina/Buenos_Aires`, que también es el valor predeterminado de `salon_setting.timeZone`. Cambiar ese valor en la base no cambia todavía los cálculos de disponibilidad.

---

## 📁 Estructura del Código

```text
├── app/
│   ├── actions/
│   │   ├── booking.ts       # Server Actions para reserva pública
│   │   ├── clients.ts       # Server Actions para gestión de clientes
│   │   └── dashboard.ts     # Server Actions para turnos, pagos e inventario
│   ├── api/
│   │   ├── auth/[...all]/   # Endpoint de Better Auth
│   ├── equipo/              # Administración de usuarios, roles e invitaciones
│   ├── reservar/
│   │   └── page.tsx         # Página del portal público de reservas online
│   ├── sign-in/ & sign-up/  # Vistas de autenticación
│   ├── globals.css          # Estilos globales y tokens del salón
│   ├── layout.tsx           # Layout principal
│   └── page.tsx             # Panel de administración principal (Dashboard)
├── components/
│   ├── auth-form.tsx        # Formulario de autenticación
│   ├── dashboard-client.tsx # Componente interactivo del panel administrativo
│   └── public-booking-client.tsx # Asistente de reserva online pública
├── drizzle/                 # Archivos SQL de migraciones versionadas
├── drizzle.config.ts        # Configuración de Drizzle Kit
├── lib/
│   ├── business-logic.ts    # Motor de reglas de negocio, duraciones, colisiones y señas
│   ├── business-logic.test.ts # Pruebas unitarias de reglas de negocio puras
│   ├── offline-sync.ts      # Manejador de sincronización y cola IndexedDB
│   ├── auth.ts & auth-client.ts # Configuración de Better Auth
│   └── db/
│       ├── schema.ts        # Modelo relacional completo (Drizzle ORM)
│       ├── seed-data.ts     # Datos semilla de inicialización del salón
│       └── salon-repository.ts # Repositorio de datos y transacciones
├── package.json
└── tsconfig.json
```

---

## 📄 Licencia

Este proyecto es propiedad de Atelier Beauty Studio. Todos los derechos reservados.
