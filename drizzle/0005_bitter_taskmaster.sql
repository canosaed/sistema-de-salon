CREATE TABLE "professional_specialty" (
	"id" text PRIMARY KEY NOT NULL,
	"professionalId" text NOT NULL,
	"specialtyId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "specialty" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
WITH legacy_specialties AS (
	SELECT professional.id AS "professionalId", btrim(split.name) AS name
	FROM professional
	CROSS JOIN LATERAL regexp_split_to_table(coalesce(professional.specialties, ''), ',') AS split(name)
	WHERE btrim(split.name) <> ''
),
unique_specialties AS (
	SELECT DISTINCT ON (lower(name)) name
	FROM legacy_specialties
	ORDER BY lower(name), name
)
INSERT INTO specialty (id, name)
SELECT gen_random_uuid()::text, name
FROM unique_specialties;
--> statement-breakpoint
WITH legacy_specialties AS (
	SELECT professional.id AS "professionalId", btrim(split.name) AS name
	FROM professional
	CROSS JOIN LATERAL regexp_split_to_table(coalesce(professional.specialties, ''), ',') AS split(name)
	WHERE btrim(split.name) <> ''
),
assignments AS (
	SELECT DISTINCT legacy_specialties."professionalId", specialty.id AS "specialtyId"
	FROM legacy_specialties
	JOIN specialty ON lower(specialty.name) = lower(legacy_specialties.name)
)
INSERT INTO professional_specialty (id, "professionalId", "specialtyId")
SELECT gen_random_uuid()::text, "professionalId", "specialtyId"
FROM assignments;
--> statement-breakpoint
ALTER TABLE "professional_specialty" ADD CONSTRAINT "professional_specialty_professionalId_professional_id_fk" FOREIGN KEY ("professionalId") REFERENCES "public"."professional"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_specialty" ADD CONSTRAINT "professional_specialty_specialtyId_specialty_id_fk" FOREIGN KEY ("specialtyId") REFERENCES "public"."specialty"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "professional_specialty_pair_unique" ON "professional_specialty" USING btree ("professionalId","specialtyId");--> statement-breakpoint
CREATE UNIQUE INDEX "specialty_name_lower_unique" ON "specialty" USING btree (lower("name"));