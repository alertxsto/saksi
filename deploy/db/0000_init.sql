CREATE TYPE "public"."tamper_action" AS ENUM('edit', 'delete', 'restore');--> statement-breakpoint
CREATE TYPE "public"."ai_fallback" AS ENUM('primary', 'fallback', 'cached', 'template');--> statement-breakpoint
CREATE TYPE "public"."ai_feature" AS ENUM('explain', 'draft');--> statement-breakpoint
CREATE TYPE "public"."breach_mode" AS ENUM('on_time', 'late');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('pending', 'submitted', 'anchored', 'failed');--> statement-breakpoint
CREATE TABLE "access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"controller_id" text NOT NULL,
	"subject_id" uuid,
	"subject_pseudonym" text NOT NULL,
	"purpose_text_enc" text NOT NULL,
	"purpose_salt_enc" text NOT NULL,
	"enc_iv" text NOT NULL,
	"purpose_hash" text NOT NULL,
	"legal_basis_key" text NOT NULL,
	"event_type" smallint NOT NULL,
	"evidence_enc" text NOT NULL,
	"evidence_iv" text NOT NULL,
	"evidence_hash" text NOT NULL,
	"status" "record_status" DEFAULT 'pending' NOT NULL,
	"fail_reason" text,
	"tx_hash" text,
	"log_index" integer,
	"block_number" bigint,
	"block_time" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_event_type" CHECK ("access_events"."event_type" between 0 and 3)
);
--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature" "ai_feature" NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_hash" text NOT NULL,
	"output_json" jsonb NOT NULL,
	"output_hash" text NOT NULL,
	"latency_ms" integer NOT NULL,
	"fallback_level" "ai_fallback" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "breach_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"controller_id" text NOT NULL,
	"report_json_enc" text NOT NULL,
	"report_iv" text NOT NULL,
	"report_hash" text NOT NULL,
	"affected_count_enc" text NOT NULL,
	"count_salt_enc" text NOT NULL,
	"affected_count_hash" text NOT NULL,
	"detected_at" bigint NOT NULL,
	"mode" "breach_mode" NOT NULL,
	"status" "record_status" DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"log_index" integer,
	"anchored_at" bigint,
	"late_by_sec" bigint,
	"ai_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citizen_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window" bigint NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "controllers" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"eoa" text NOT NULL,
	"registry_tx" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "controllers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" char(6) NOT NULL,
	"display_name" text NOT NULL,
	"pseudonym_salt_enc" text,
	"pseudonym_salt_iv" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_code_unique" UNIQUE("code"),
	CONSTRAINT "subject_salt_pair" CHECK (("subjects"."pseudonym_salt_enc" is null) = ("subjects"."pseudonym_salt_iv" is null))
);
--> statement-breakpoint
CREATE TABLE "tamper_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_table" text NOT NULL,
	"target_id" uuid NOT NULL,
	"action" "tamper_action" NOT NULL,
	"before_snapshot_enc" text NOT NULL,
	"before_hash" text NOT NULL,
	"after_hash" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_controller_id_controllers_id_fk" FOREIGN KEY ("controller_id") REFERENCES "public"."controllers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breach_reports" ADD CONSTRAINT "breach_reports_controller_id_controllers_id_fk" FOREIGN KEY ("controller_id") REFERENCES "public"."controllers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breach_reports" ADD CONSTRAINT "breach_reports_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_by_subject" ON "access_events" USING btree ("subject_id","created_at");--> statement-breakpoint
CREATE INDEX "access_by_controller" ON "access_events" USING btree ("controller_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "access_event_log" ON "access_events" USING btree ("tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "ai_cache_lookup" ON "ai_runs" USING btree ("feature","input_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "breach_event_log" ON "breach_reports" USING btree ("tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "tamper_by_target" ON "tamper_log" USING btree ("target_id","at");--> statement-breakpoint
-- 002_citizen_reports (same DDL as deploy/db/migrations/002_citizen_reports.sql plus 004_report_unlink.sql, for fresh volumes)
DO $$ BEGIN
  CREATE TYPE "public"."report_reason" AS ENUM('not_me', 'object', 'altered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "citizen_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"subject_id" uuid,
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
