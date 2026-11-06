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
- **Base de Datos y ORM:** PostgreSQL con [Drizzle ORM](https://orm.drizzle.team/)
- **Autenticación:** [Better Auth](https://www.better-auth.com/)
- **Almacenamiento Local / Offline:** IndexedDB (`lib/offline-sync.ts`)
- **Gestor de Paquetes:** [pnpm](https://pnpm.io/) (versión 10+ o 12)

---

## 🚀 Instrucciones para Ejecutar el Proyecto

### Requisitos Previos

1. **Node.js:** Versión 18+ o superior (probado en Node.js v22).
2. **pnpm:** Versión 9+ o 12 (`corepack enable` o `npm install -g pnpm`).
3. *(Opcional)* Instancia de PostgreSQL (para entorno de producción persistente).

---

### 1. Clonar el Repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd <NOMBRE_DEL_DIRECTORIO>
```

---

### 2. Variables de Entorno

Crear un archivo `.env` o `.env.local` en la raíz del proyecto basándose en las siguientes variables recomendadas:

```env
# URL base de la aplicación
BETTER_AUTH_URL=http://localhost:3000

# Secreto para sesiones y tokens de Better Auth
BETTER_AUTH_SECRET=un_secreto_seguro_para_better_auth_1234567890

# Conexión a Base de Datos PostgreSQL (requerido para Better Auth / Drizzle)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atelier_beauty
```

> **Nota:** La aplicación cuenta con un repositorio en memoria auto-inicializado con datos semilla completos (`seed-data.ts`) para permitir el funcionamiento inmediato de todas las pantallas, turnos, catálogo y disponibilidad sin depender obligatoriamente de una base de datos externa en desarrollo.

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

### 6. Ejecución de Pruebas Obligatorias

El sistema incluye una suite de pruebas automatizadas que valida exhaustivamente los **15 escenarios funcionales obligatorios** exigidos en las especificaciones del negocio:

1. Reserva pública desde celular.
2. Creación manual de turno en recepción.
3. Detección y bloqueo de solicitudes simultáneas en la misma profesional.
4. Prevención de dobles reservas concurrentes en el mismo horario.
5. Selección múltiple de servicios con cálculo secuencial de duraciones y preparación/limpieza.
6. Inmutabilidad histórica de turnos contratados ante cambios de catálogo.
7. Respeto de jornadas laborales, horarios y descansos intermedios.
8. Registro de señas y cálculo de saldos.
9. Pagos parciales y cancelación final de deuda.
10. Cancelación de turnos y liberación inmediata del horario en la agenda.
11. Reprogramación de turnos con validación de no colisión.
12. Pérdida de conexión y almacenamiento en cola offline.
13. Recuperación de conexión y sincronización de datos.
14. Detección de conflictos priorizando la nube como fuente de verdad.
15. Control de consumo y movimientos de stock en inventario.

Para ejecutar las pruebas:
Con el servidor en marcha (`pnpm start` o `pnpm dev`), consulta el endpoint de pruebas:

```bash
curl http://localhost:3000/api/tests
```

O visita en tu navegador: [http://localhost:3000/api/tests](http://localhost:3000/api/tests) para obtener el reporte JSON detallado con los 15 escenarios verificados al 100%.

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
│   │   └── tests/           # Endpoint ejecutable de los 15 escenarios obligatorios
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
├── lib/
│   ├── business-logic.ts    # Motor de reglas de negocio, duraciones, colisiones y señas
│   ├── test-runner.ts       # Suite de validación de los 15 escenarios
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
