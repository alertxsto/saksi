import 'server-only';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import { canonicalize, evidenceHash } from '../shared/commit';
import { decrypt, encrypt } from './crypto';
import { HttpError, missing } from './http';

export const tamperInput = z.strictObject({ action: z.enum(['edit', 'delete', 'restore']), eventId: z.uuid() });
const table = 'access_events';
const conflict = () => new HttpError(409, 'TAMPER_CONFLICT', 'The demo row changed or cannot be altered in this state.');
type Snapshot = Record<string, unknown>;

export async function tamper({ action, eventId }: z.output<typeof tamperInput>) {
  const { rows: [live] } = await db().execute<{ snapshot: Snapshot }>(sql`
    select to_jsonb(a) as snapshot from access_events a where id = ${eventId}::uuid and status = 'anchored'
  `);
  const before = live?.snapshot ?? null;
  let after: Snapshot | null;
  if (action === 'edit') {
    if (!before) throw missing();
    if (before.event_type !== 3) throw conflict();
    after = { ...before, event_type: 0 };
  } else if (action === 'delete') {
    if (!before) throw missing();
    after = null;
  } else {
    const { rows: [entry] } = await db().execute<{ snapshot: string; after_hash: string }>(sql`
      select before_snapshot_enc as snapshot, after_hash from tamper_log
      where target_table = ${table} and target_id = ${eventId}::uuid and action in ('edit', 'delete')
      order by at desc, id desc limit 1
    `);
    if (!entry || entry.after_hash !== evidenceHash(before)) throw conflict();
    const [iv, ciphertext] = entry.snapshot.split('.');
    after = z.record(z.string(), z.unknown()).parse(JSON.parse(decrypt(ciphertext, iv)));
  }

  const encrypted = encrypt(canonicalize(before));
  const mutation = !after ? sql`
    delete from access_events a where id = ${eventId}::uuid and to_jsonb(a) = ${canonicalize(before)}::jsonb returning id
  ` : !before ? sql`
    insert into access_events select * from jsonb_populate_record(null::access_events, ${canonicalize(after)}::jsonb)
    on conflict do nothing returning id
  ` : sql`
    update access_events a set event_type = ${after.event_type} where id = ${eventId}::uuid
    and to_jsonb(a) = ${canonicalize(before)}::jsonb returning id
  `;
  const change = await db().execute(sql`
    with changed as (${mutation})
    insert into tamper_log (target_table, target_id, action, before_snapshot_enc, before_hash, after_hash)
    select ${table}, id, ${action}::tamper_action, ${encrypted.iv + '.' + encrypted.ciphertext},
      ${evidenceHash(before)}, ${evidenceHash(after)} from changed returning target_id
  `);
  if (!change.rows.length) throw conflict();
  return { action, eventId };
}
