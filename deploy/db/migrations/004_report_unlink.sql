-- 004: a citizen who deletes their profile is unlinked from their reports too (unlinkCitizen in web/lib/server/access.ts).
-- The report stays for the regulator; only the link to the subject is cleared.
-- Idempotent: safe to run more than once. Not picked up by docker-entrypoint-initdb.d (subfolder); apply by hand from ~/saksi/deploy:
--   docker compose exec -T db psql -U saksi -d saksi -v ON_ERROR_STOP=1 < db/migrations/004_report_unlink.sql
ALTER TABLE citizen_reports ALTER COLUMN subject_id DROP NOT NULL;
