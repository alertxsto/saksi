import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { db } from '../../db/client';
import { canonicalize, evidenceHash } from '../shared/commit';
import { EVENT_LABELS, EVENT_TYPES } from '../shared/types';
import { decrypt, encrypt } from './crypto';
import { HttpError, missing } from './http';

export const tamperInput = z.strictObject({ action: z.enum(['edit', 'delete', 'restore']), eventId: z.uuid() });
const table = 'access_events';
const conflict = () => new HttpError(409, 'TAMPER_CONFLICT', 'The demo row changed or cannot be altered in this state.');
type Snapshot = Record<string, unknown>;

/** One changed column, as the presenter screen shows it. Encrypted columns are never decrypted here. */
export type TamperChange = { field: string; before: string; after: string };
export type TamperReport = {
  action: z.output<typeof tamperInput>['action']; eventId: string;
  /** The statement that ran, parameterised exactly as sent to Postgres ($1, $2…); parameter values are not included. */
  statement: string;
  /** The non-secret parameters: the new event_type and the row id. The row snapshot and its ciphertext are omitted. */
  params: { name: string; value: string }[];
  changes: TamperChange[];
  /** keccak256 of the canonical row JSON before and after (null = no row), as written to tamper_log. */
  rowHash: { before: string | null; after: string | null };
  log: { id: string; at: string };
};

const dialect = new PgDialect();
const KEYWORDS = /\s+(?=(with|insert into|select|update|delete from|where|and|on conflict|returning)\b)/gi;
/** The SQL text as Postgres received it, one clause per line for the projector. */
export function statementText(query: SQL) {
  return dialect.sqlToQuery(query).sql.replace(/\s+/g, ' ').trim().replace(KEYWORDS, '\n');
}
const eventLabel = (value: unknown) => {
  const name = EVENT_TYPES[Number(value)];
  return name ? `${value} · ${EVENT_LABELS[name]}` : String(value);
};
/** Column-level diff of two access_events rows. Only plain metadata is shown; encrypted columns say "encrypted". */
export function describeChanges(before: Snapshot | null, after: Snapshot | null): TamperChange[] {
  if (!before || !after) return [{ field: 'row', before: before ? 'present' : 'absent', after: after ? 'present' : 'absent' }];
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
    .filter((key) => canonicalize(before[key] ?? null) !== canonicalize(after[key] ?? null))
    .map((field) => field === 'event_type'
      ? { field, before: eventLabel(before[field]), after: eventLabel(after[field]) }
      : /_enc$|_iv$|^enc_iv$/.test(field) ? { field, before: 'encrypted', after: 'encrypted (changed)' }
        : { field, before: String(before[field] ?? 'null'), after: String(after[field] ?? 'null') });
}

export async function tamper({ action, eventId }: z.output<typeof tamperInput>) {
  const [live] = await db().execute<{ snapshot: Snapshot }>(sql`
    select to_jsonb(a) as snapshot from access_events a where id = ${eventId}::uuid and status = 'anchored'
  `);
  const before = live?.snapshot ?? null;
  let after: Snapshot | null;
  if (action === 'edit') {
    if (!before) throw missing();
    // One edit at a time: a row whose current state came from an edit must be restored first, so restore stays a
    // single step back to the anchored values.
    const [edited] = await db().execute(sql`
      select 1 from tamper_log where target_table = ${table} and target_id = ${eventId}::uuid and action = 'edit'
        and after_hash = ${evidenceHash(before)} limit 1
    `);
    if (edited) throw conflict();
    // Any action can be tampered: READ becomes SHARE_THIRD_PARTY, every other action becomes READ.
    after = { ...before, event_type: before.event_type === 0 ? 3 : 0 };
  } else if (action === 'delete') {
    if (!before) throw missing();
    after = null;
  } else {
    // Undo the latest edit or delete that produced the row's current state. Matching on after_hash (rather than
    // taking the latest entry) also unwinds edit → delete → restore, whose last delete ends in "no row".
    const [entry] = await db().execute<{ snapshot: string; after_hash: string }>(sql`
      select before_snapshot_enc as snapshot, after_hash from tamper_log
      where target_table = ${table} and target_id = ${eventId}::uuid and action in ('edit', 'delete')
        and after_hash = ${evidenceHash(before)}
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
  const statement = sql`
    with changed as (${mutation})
    insert into tamper_log (target_table, target_id, action, before_snapshot_enc, before_hash, after_hash)
    select ${table}, id, ${action}::tamper_action, ${encrypted.iv + '.' + encrypted.ciphertext},
      ${evidenceHash(before)}, ${evidenceHash(after)} from changed returning id, target_id, before_hash, after_hash, at
  `;
  const [entry] = await db().execute<{ id: string; before_hash: string; after_hash: string | null; at: string | Date }>(statement);
  if (!entry) throw conflict();
  const report: TamperReport = {
    action, eventId, statement: statementText(statement),
    params: [
      ...(before && after ? [{ name: 'event_type', value: eventLabel(after.event_type) }] : []),
      { name: 'id', value: eventId },
    ],
    changes: describeChanges(before, after),
    rowHash: { before: before ? entry.before_hash : null, after: after ? entry.after_hash : null },
    log: { id: entry.id, at: new Date(entry.at).toISOString() },
  };
  return report;
}
