import 'server-only';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import { evidenceHash } from '../shared/commit';
import type { DemoReceipt } from '../shared/types';
import { decrypt } from './crypto';

// Presenter console (/operator): anchored receipts plus rows the demo deleted, so each can be tampered and restored.
// Only display fields leave the server; purpose, evidence, pseudonyms and citizen codes stay in the database.
const LIMIT = 20;
const row = z.object({
  id: z.uuid(), controller_id: z.string(), event_type: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  created_at: z.string(), tx_hash: z.string().nullable(), log_index: z.number().int().nullable(), block_number: z.number().int().nullable(),
  status: z.enum(['pending', 'submitted', 'anchored', 'failed']),
});
export type LiveRow = { snapshot: Record<string, unknown>; controllerName: string };
export type DeletedRow = { snapshot: Record<string, unknown> };
export type TamperEntry = { targetId: string; afterHash: string | null };

function view(snapshot: Record<string, unknown>, controllerName: string, state: DemoReceipt['state'], restorable: boolean): DemoReceipt {
  const r = row.parse(snapshot);
  return {
    id: r.id, controllerName, eventType: r.event_type, createdAt: new Date(r.created_at).toISOString(), txHash: r.tx_hash,
    logIndex: r.log_index, blockNumber: r.block_number, status: r.status, state, restorable,
    // tamper() flips any action (READ to SHARE_THIRD_PARTY, anything else to READ) on a row that is not already edited.
    editable: state === 'intact',
  };
}

/**
 * A live row is "edited" when an edit or delete entry in tamper_log ends in exactly its current snapshot,
 * which is the entry tamper('restore') would undo. Deleted rows are always restorable from their last delete.
 */
export function toDemoReceipts(live: LiveRow[], deleted: DeletedRow[], entries: TamperEntry[], names: ReadonlyMap<string, string>): DemoReceipt[] {
  const ends = new Map<string, Set<string>>();
  for (const { targetId, afterHash } of entries) {
    if (afterHash) ends.set(targetId, (ends.get(targetId) ?? new Set()).add(afterHash));
  }
  const rows = [
    ...live.map(({ snapshot, controllerName }) => {
      const restorable = ends.get(String(snapshot.id))?.has(evidenceHash(snapshot)) ?? false;
      return view(snapshot, controllerName, restorable ? 'edited' : 'intact', restorable);
    }),
    ...deleted.map(({ snapshot }) => view(snapshot, names.get(String(snapshot.controller_id)) ?? 'Unknown controller', 'deleted', true)),
  ];
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function demoReceipts() {
  const database = db();
  const [live, deleted, orgs] = await Promise.all([
    database.execute<{ snapshot: Record<string, unknown>; controller_name: string }>(sql`
      select to_jsonb(a) as snapshot, c.name as controller_name from access_events a
      join controllers c on c.id = a.controller_id where a.status = 'anchored' order by a.created_at desc limit ${LIMIT}
    `),
    // A row that is absent now was last removed by a delete (restore re-inserts), so its latest delete holds the row.
    database.execute<{ snapshot: string }>(sql`
      select snapshot from (
        select distinct on (t.target_id) t.before_snapshot_enc as snapshot, t.at from tamper_log t
        where t.target_table = 'access_events' and t.action = 'delete'
          and not exists (select 1 from access_events a where a.id = t.target_id)
        order by t.target_id, t.at desc, t.id desc
      ) latest order by at desc limit ${LIMIT}
    `),
    database.execute<{ id: string; name: string }>(sql`select id, name from controllers`),
  ]);
  const ids = live.map(({ snapshot }) => String(snapshot.id));
  const entries = ids.length ? await database.execute<{ target_id: string; after_hash: string | null }>(sql`
    select target_id, after_hash from tamper_log where target_table = 'access_events' and action in ('edit', 'delete')
    and target_id in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
  `) : [];
  const opened = deleted.map(({ snapshot }) => {
    const [iv, ciphertext] = snapshot.split('.');
    return { snapshot: z.record(z.string(), z.unknown()).parse(JSON.parse(decrypt(ciphertext, iv))) };
  });
  const rows = toDemoReceipts(
    live.map(({ snapshot, controller_name }) => ({ snapshot, controllerName: controller_name })),
    opened,
    entries.map(({ target_id, after_hash }) => ({ targetId: target_id, afterHash: after_hash })),
    new Map(orgs.map(({ id, name }) => [id, name])),
  );
  return { rows };
}
