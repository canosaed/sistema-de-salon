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

CREATE TABLE IF NOT EXISTS technique (id text PRIMARY KEY, "serviceId" text NOT NULL, name text NOT NULL, description text, "additionalPrice" numeric(12,2) NOT NULL DEFAULT 0, "additionalMinutes" integer NOT NULL DEFAULT 0, "isActive" boolean NOT NULL DEFAULT true, "createdAt" timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS material (id text PRIMARY KEY, name text NOT NULL, category text NOT NULL, unit text NOT NULL, "currentStock" numeric(12,2) NOT NULL DEFAULT 0, "minStock" numeric(12,2) NOT NULL DEFAULT 5, "isActive" boolean NOT NULL DEFAULT true, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS service_material (id text PRIMARY KEY, "serviceId" text NOT NULL, "techniqueId" text, "materialId" text NOT NULL, "estimatedUsage" numeric(10,2) NOT NULL DEFAULT 1, "createdAt" timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS professional_service (id text PRIMARY KEY, "professionalId" text NOT NULL, "serviceId" text NOT NULL);
CREATE TABLE IF NOT EXISTS professional_schedule (id text PRIMARY KEY, "professionalId" text NOT NULL, "dayOfWeek" integer NOT NULL, "startTime" text NOT NULL, "endTime" text NOT NULL, "breakStartTime" text, "breakEndTime" text, "isActive" boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS professional_absence (id text PRIMARY KEY, "professionalId" text NOT NULL, "startDate" text NOT NULL, "endDate" text NOT NULL, reason text NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS schedule_block (id text PRIMARY KEY, "professionalId" text, "startDateTime" timestamp NOT NULL, "endDateTime" timestamp NOT NULL, reason text NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS appointment_service (id text PRIMARY KEY, "appointmentId" text NOT NULL, "serviceId" text NOT NULL, "techniqueId" text, "historicServiceName" text NOT NULL, "historicTechniqueName" text, "historicPrice" numeric(12,2) NOT NULL, "historicDurationMinutes" integer NOT NULL, "historicPrepMinutes" integer NOT NULL DEFAULT 0, "historicCleanupMinutes" integer NOT NULL DEFAULT 0, "sequenceOrder" integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS appointment_history (id text PRIMARY KEY, "appointmentId" text NOT NULL, action text NOT NULL, "actorUserId" text, details text, snapshot jsonb, "createdAt" timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS payment (id text PRIMARY KEY, "appointmentId" text NOT NULL, amount numeric(12,2) NOT NULL, method text NOT NULL, type text NOT NULL, status text NOT NULL DEFAULT 'completed', notes text, "referenceNumber" text, "createdAt" timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS inventory_movement (id text PRIMARY KEY, "materialId" text NOT NULL, type text NOT NULL, quantity numeric(10,2) NOT NULL, reason text NOT NULL, "appointmentId" text, "createdAt" timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS salon_setting (id text PRIMARY KEY, "salonName" text NOT NULL DEFAULT 'Atelier Beauty Studio', "timeZone" text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires', currency text NOT NULL DEFAULT 'ARS', "minNoticeHoursForBooking" integer NOT NULL DEFAULT 2, "minNoticeHoursForCancellation" integer NOT NULL DEFAULT 24, "autoConfirmPublicBookings" boolean NOT NULL DEFAULT false, "defaultDepositType" text NOT NULL DEFAULT 'percentage', "defaultDepositPercentage" integer NOT NULL DEFAULT 30, "defaultDepositFixed" numeric(12,2) NOT NULL DEFAULT 5000, "updatedAt" timestamp NOT NULL DEFAULT now());

ALTER TABLE service_category ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE service_category ADD COLUMN IF NOT EXISTS "order" integer NOT NULL DEFAULT 0;
ALTER TABLE service ADD COLUMN IF NOT EXISTS "prepMinutes" integer NOT NULL DEFAULT 0;
ALTER TABLE service ADD COLUMN IF NOT EXISTS "cleanupMinutes" integer NOT NULL DEFAULT 0;
ALTER TABLE service ADD COLUMN IF NOT EXISTS "cancellationPolicy" text;
ALTER TABLE professional ADD COLUMN IF NOT EXISTS initials text;

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
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "clientPreferences" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "cancellationReason" text;
ALTER TABLE appointment ADD COLUMN IF NOT EXISTS "cancelledAt" timestamp;

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

-- Completa categorías y valores del catálogo base cuando la migración legacy sólo creó servicios por nombre.
INSERT INTO service_category (id, "userId", name, slug, description, "order")
SELECT category.id, owners."userId", category.name, category.slug, category.description, category."order"
FROM (VALUES
  ('cat-manos', 'Manos', 'manos', 'Cuidado y belleza de manos y uñas', 1),
  ('cat-pies', 'Pies', 'pies', 'Pedicuría tradicional, estética y combinada', 2),
  ('cat-pestanas', 'Pestañas', 'pestanas', 'Lifting y extensiones de pestañas', 3)
) AS category(id, name, slug, description, "order")
CROSS JOIN LATERAL (SELECT "userId" FROM service LIMIT 1) owners
ON CONFLICT (id) DO NOTHING;

UPDATE service
SET "categoryId" = CASE name WHEN 'Soft gel' THEN 'cat-manos' WHEN 'Kapping acrílico / gel' THEN 'cat-manos' ELSE "categoryId" END,
    price = CASE name WHEN 'Soft gel' THEN 27000 WHEN 'Kapping acrílico / gel' THEN 22000 ELSE price END,
    "durationMinutes" = CASE name WHEN 'Soft gel' THEN 90 WHEN 'Kapping acrílico / gel' THEN 60 ELSE "durationMinutes" END
WHERE name IN ('Soft gel', 'Kapping acrílico / gel');

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
