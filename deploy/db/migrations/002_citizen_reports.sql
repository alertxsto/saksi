-- 002: citizen reports to the regulator (POST /api/citizen/report, GET /api/regulator/reports).
-- Idempotent: safe to run more than once. Apply with
--   docker compose exec -T db psql -U saksi -d saksi -v ON_ERROR_STOP=1 < deploy/db/migrations/002_citizen_reports.sql
-- event_id deliberately has no foreign key: the presenter console deletes and re-inserts access_events rows by id
-- (web/lib/server/tamper.ts), and a report must outlive that. The access row's controller, event type, chain
-- position and sealed time are copied into the report when it is filed.
BEGIN;

DO $$ BEGIN
  CREATE TYPE "public"."report_reason" AS ENUM('not_me', 'object', 'altered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "citizen_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"controller_id" text NOT NULL,
	"event_type" smallint NOT NULL,
	"tx_hash" text,
	"log_index" integer,
	"sealed_at" bigint,
	"reason" "report_reason" NOT NULL,
	"note" text,
	"server_verdict" text NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	CONSTRAINT "citizen_reports_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "citizen_reports_controller_id_controllers_id_fk" FOREIGN KEY ("controller_id") REFERENCES "public"."controllers"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "report_note_length" CHECK ("citizen_reports"."note" is null or char_length("citizen_reports"."note") <= 280),
	CONSTRAINT "report_verdict" CHECK ("citizen_reports"."server_verdict" in ('MATCH', 'ALTERED', 'NOT_FOUND', 'DELETED')),
	CONSTRAINT "report_event_type" CHECK ("citizen_reports"."event_type" between 0 and 3)
);

CREATE INDEX IF NOT EXISTS "report_by_status" ON "citizen_reports" USING btree ("status","created_at");
CREATE INDEX IF NOT EXISTS "report_by_controller" ON "citizen_reports" USING btree ("controller_id","status");
CREATE UNIQUE INDEX IF NOT EXISTS "report_open_once" ON "citizen_reports" USING btree ("event_id","reason") WHERE "citizen_reports"."status" = 'open';

COMMIT;
