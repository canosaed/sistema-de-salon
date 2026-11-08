-- Reconciliación no destructiva de la base Neon existente.
-- Esta migración se ejecuta de forma controlada contra Neon y conserva las columnas legacy durante el backfill.

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
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "totalDurationMinutes" integer;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "totalPrice" numeric(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "requiredDeposit" numeric(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "paymentStatus" text NOT NULL DEFAULT 'pending';
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "isPublicBooking" boolean NOT NULL DEFAULT false;

-- Backfill no destructivo de las reservas legacy existentes.
INSERT INTO professional (id, "userId", name)
SELECT md5('legacy-professional:' || lower(trim(a.professional))),
       min(a."userId"),
       trim(a.professional)
FROM appointment a
WHERE nullif(trim(a.professional), '') IS NOT NULL
GROUP BY lower(trim(a.professional))
ON CONFLICT (id) DO NOTHING;

INSERT INTO service (id, "userId", name, "durationMinutes", price)
SELECT md5('legacy-service:' || lower(trim(a.service))),
       min(a."userId"),
       trim(a.service),
       60,
       0
FROM appointment a
WHERE nullif(trim(a.service), '') IS NOT NULL
GROUP BY lower(trim(a.service))
ON CONFLICT (id) DO NOTHING;

UPDATE appointment a
SET "clientId" = COALESCE(a."clientId", c.id),
    "professionalId" = COALESCE(a."professionalId", p.id),
    "serviceId" = COALESCE(a."serviceId", s.id),
    "startDateTime" = COALESCE(a."startDateTime", to_timestamp(a."appointmentDate"::text || ' ' || a."appointmentTime", 'YYYY-MM-DD HH24:MI')),
    "endDateTime" = COALESCE(a."endDateTime", to_timestamp(a."appointmentDate"::text || ' ' || a."appointmentTime", 'YYYY-MM-DD HH24:MI') + interval '60 minutes'),
    "totalDurationMinutes" = COALESCE(a."totalDurationMinutes", 60),
    status = CASE WHEN lower(a.status) IN ('pendiente', 'pending') THEN 'pending_confirmation' ELSE a.status END,
    "paymentStatus" = COALESCE(a."paymentStatus", 'pending')
FROM client c
JOIN professional p ON lower(p.name) = lower(trim(a.professional))
JOIN service s ON lower(s.name) = lower(trim(a.service))
WHERE c.id = a."clientId" OR lower(c.name) = lower(trim(a.client));

-- No se marca ninguna columna nueva como NOT NULL hasta verificar los datos migrados.


CREATE INDEX IF NOT EXISTS appointment_professional_start_idx
  ON appointment ("professionalId", "startDateTime");
CREATE INDEX IF NOT EXISTS appointment_client_idx
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
