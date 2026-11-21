-- 003: two clearly fictional public-sector controllers registered on Sepolia on 22 Nov 2026.
-- The app also syncs any controller it meets from the ControllerRegistered log (lib/server/registry.ts),
-- so this file only pins the slug and name for rows that already exist or were synced before it ran.
-- Idempotent: safe to run more than once. Not picked up by docker-entrypoint-initdb.d (subfolder); apply by hand:
--   docker compose exec -T db psql -U saksi -d saksi -v ON_ERROR_STOP=1 < db/migrations/003_public_sector_controllers.sql
-- controllerId = keccak256("ctrl:" + slug). Registry 0x3d9dE4717a7398d24239b8370b23DCAd7a07f737.
BEGIN;
INSERT INTO controllers (id, slug, name, eoa, registry_tx) VALUES
  ('0x9957be43371e57071d52b666cc18f549a3653d4f83ace0b10fd3cdd78555a3a3', 'disdukcapil-kota-contoh',
   'Disdukcapil Kota Contoh (fiktif)', '0xe4788acc311c6135a848f82823456f06f2bb74e0',
   '0x3e77d99e6a561ac70a94edce0c419343a97a92a003d61896e408bede6ff2c5fc'),
  ('0xa0e63a2e54ad8e184af15ab8f53025356b84a9f1dfd53302c09ffe6d85a51454', 'rsud-contoh',
   'RSUD Contoh (fiktif)', '0x5678b387056c7571813f8acf934dd145d9f98c9d',
   '0x7616d520a2ed9d7d6ce63a24b406b0c8bdeb25525bec8494b9021f0c00266fec')
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name, eoa = EXCLUDED.eoa, registry_tx = EXCLUDED.registry_tx;
COMMIT;
