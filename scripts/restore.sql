-- Synthetic demo only. Use the same event_id that was changed by tamper.sql.
\set ON_ERROR_STOP on
UPDATE access_events SET event_type = 3
WHERE id = :'event_id'::uuid AND event_type = 0 AND status = 'anchored'
RETURNING id, event_type;
