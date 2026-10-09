-- Prevent active bookings from overlapping even when their start times differ.
-- The application also takes a transaction-scoped, per-date advisory lock and
-- rechecks the configurable buffer before inserting.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Fail without changing data if a previous application version already left
-- overlapping active appointments. Resolve those records manually, then retry.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Appointment" first_appointment
        JOIN "Appointment" second_appointment
          ON first_appointment."date" = second_appointment."date"
         AND first_appointment."id" < second_appointment."id"
         AND first_appointment."status" IN ('PENDING', 'CONFIRMED')
         AND second_appointment."status" IN ('PENDING', 'CONFIRMED')
         AND int4range(first_appointment."startMinutes", first_appointment."endMinutes", '[)')
             && int4range(second_appointment."startMinutes", second_appointment."endMinutes", '[)')
    ) THEN
        RAISE EXCEPTION 'Active appointments overlap; resolve them before applying Appointment_active_no_overlap.';
    END IF;
END
$$;

ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_active_no_overlap"
    EXCLUDE USING gist (
        "date" WITH =,
        int4range("startMinutes", "endMinutes", '[)') WITH &&
    ) WHERE ("status" IN ('PENDING', 'CONFIRMED'));
