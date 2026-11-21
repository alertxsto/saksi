-- 006: the regulator's "Audit priority" panel saves its AI runs as feature 'anomaly' (lib/server/anomaly.ts).
-- Adding an enum value is non-destructive and safe to run more than once.
-- From ~/saksi/deploy:
--   docker compose exec -T db psql -U saksi -d saksi -v ON_ERROR_STOP=1 < db/migrations/006_ai_anomaly.sql
ALTER TYPE ai_feature ADD VALUE IF NOT EXISTS 'anomaly';
