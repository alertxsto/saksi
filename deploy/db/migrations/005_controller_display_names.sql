-- 005: show fictional display names for the first three controllers.
-- Their on-chain ControllerRegistered names ("Demo One", ...) are immutable, but the chain only binds id + wallet;
-- the name is display-only. Mirrors web/lib/shared/controller-names.ts. Safe to run more than once.
-- From ~/saksi/deploy:
--   docker compose exec -T db psql -U saksi -d saksi -v ON_ERROR_STOP=1 < db/migrations/005_controller_display_names.sql
UPDATE controllers SET name = 'Bank Kredit Contoh (fiktif)' WHERE slug = 'demo-one';
UPDATE controllers SET name = 'Asuransi Contoh (fiktif)' WHERE slug = 'demo-two';
UPDATE controllers SET name = 'Fintech Contoh (fiktif)' WHERE slug = 'demo-spare';
