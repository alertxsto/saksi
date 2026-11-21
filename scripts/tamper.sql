-- Synthetic demo only. Usage: psql "$DATABASE_URL" -v event_id='<uuid>' -f scripts/tamper.sql
\set ON_ERROR_STOP on
UPDATE access_events SET event_type = 0
WHERE id = :'event_id'::uuid AND event_type = 3 AND status = 'anchored'
RETURNING id, event_type;
