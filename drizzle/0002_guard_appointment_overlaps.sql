CREATE INDEX IF NOT EXISTS appointment_active_interval_idx
  ON appointment ("professionalId", "startDateTime", "endDateTime")
  WHERE status IN ('pending_confirmation', 'confirmed', 'waiting', 'in_progress');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status NOT IN ('pending_confirmation', 'confirmed', 'waiting', 'in_progress') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(NEW."professionalId"),
    hashtext('appointments')
  );

  IF EXISTS (
    SELECT 1
    FROM appointment existing
    WHERE existing."professionalId" = NEW."professionalId"
      AND existing.id <> NEW.id
      AND existing.status IN ('pending_confirmation', 'confirmed', 'waiting', 'in_progress')
      AND existing."startDateTime" < NEW."endDateTime"
      AND existing."endDateTime" > NEW."startDateTime"
  ) THEN
    RAISE EXCEPTION 'El horario se superpone con otro turno activo.'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS appointment_prevent_overlap ON appointment;
--> statement-breakpoint
CREATE TRIGGER appointment_prevent_overlap
  BEFORE INSERT OR UPDATE OF "professionalId", "startDateTime", "endDateTime", status
  ON appointment
  FOR EACH ROW
  EXECUTE FUNCTION prevent_appointment_overlap();
