-- Reconciliación no destructiva de la base Neon existente.
-- Esta migración se prepara en código, pero NO se ejecuta automáticamente.
-- Requiere revisión y ejecución explícita contra la base objetivo.

CREATE TABLE IF NOT EXISTS service_category (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#8B5CF6',
  "isActive" boolean NOT NULL DEFAULT true,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "categoryId" text REFERENCES service_category(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  "durationMinutes" integer NOT NULL,
  price numeric(10, 2) NOT NULL,
  "depositType" text NOT NULL DEFAULT 'percentage',
  "depositValue" numeric(10, 2) NOT NULL DEFAULT 30,
  "allowPublicBooking" boolean NOT NULL DEFAULT true,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  specialties text[] NOT NULL DEFAULT '{}',
  color text NOT NULL DEFAULT '#8B5CF6',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- Completa la tabla client existente sin eliminar ni sobrescribir registros.
ALTER TABLE client ADD COLUMN IF NOT EXISTS "birthDate" date;
ALTER TABLE client ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE client ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true;

-- Columnas canónicas para appointment. Los campos legacy se conservan durante la transición.
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "clientId" text;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "professionalId" text;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "serviceId" text;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "startDateTime" timestamp;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "endDateTime" timestamp;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS total_"durationMinutes" integer;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "totalPrice" numeric(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "requiredDeposit" numeric(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "paymentStatus" text NOT NULL DEFAULT 'pending';
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "isPublicBooking" boolean NOT NULL DEFAULT false;

-- La aplicación de migración debe ejecutar primero una rutina de backfill que:
-- 1. relacione appointment.client con client.name;
-- 2. cree profesionales desde appointment.professional cuando no existan;
-- 3. convierta appointmentDate + appointmentTime a start/"endDateTime";
-- 4. relacione service por nombre y preserve los valores legacy.
-- No se marca ninguna columna legacy como NOT NULL nueva hasta verificar el backfill.

CREATE INDEX IF NOT EXISTS appointment_professional_start_idx
  ON appointment ("professionalId", "startDateTime");
CREATE INDEX IF NOT EXISTS appointment_"clientId"x
  ON appointment ("clientId");
CREATE INDEX IF NOT EXISTS appointment_status_idx
  ON appointment (status);
CREATE UNIQUE INDEX IF NOT EXISTS appointment_active_slot_unique
  ON appointment ("professionalId", "startDateTime")
  WHERE status IN ('pending_confirmation', 'confirmed', 'in_progress');

CREATE TABLE IF NOT EXISTS schema_migration_audit (
  id text PRIMARY KEY,
  migration_name text NOT NULL UNIQUE,
  applied_at timestamp NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
