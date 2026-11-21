import 'server-only';
import { count, eq, inArray, max, sql } from 'drizzle-orm';
import type { Hex } from 'viem';
import { db } from '../../db/client';
import { accessEvents, breachReports } from '../../db/schema';
import type { WatchRow } from '../shared/types';
import { addresses, deployBlock, events, rpc } from './chain';
import { openReportsByController } from './reports';
import { watch } from './watch';

export type RegistryChange = {
  kind: 'registered' | 'revoked'; controllerId: Hex; eoa: Hex; name?: string; blockNumber: bigint; logIndex: number; txHash: Hex;
};
export type RegisterRow = {
  id: Hex; name: string; eoa: Hex; status: 'active' | 'revoked';
  registeredAt: number | null; registeredBlock: number; registrationTx: Hex; revocationTx: Hex | null;
  sealed: number; altered: number | null; deleted: number | null;
  breachesOnTime: number; breachesLate: number; openReports: number | null; lastActivity: string | null;
};
type Counted = { controllerId: string; n: number };
export type RegisterInput = {
  changes: RegistryChange[];
  blockTimes: ReadonlyMap<bigint, number>;
  activity: (Counted & { last: Date | null })[];
  breaches: (Counted & { mode: 'on_time' | 'late'; last: Date | null })[];
  openReports: Counted[] | null;
  // Watch rows that are not MATCH, with the controller each ALTERED row's event belongs to.
  watchRows: Pick<WatchRow, 'status' | 'eventId' | 'controllerName'>[] | null;
  eventControllers: ReadonlyMap<string, string>;
};

const isHexId = (value: string) => /^0x[0-9a-f]{64}$/i.test(value);
const later = (a: Date | null | undefined, b: Date | null | undefined) => (!a ? b ?? null : !b ? a : a > b ? a : b);

/** One row per controller ever registered on chain, joined with what Saksi and Watch know about it. */
export function aggregateControllers(input: RegisterInput): RegisterRow[] {
  const ordered = [...input.changes].sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1));
  const rows = new Map<string, RegisterRow>();
  for (const change of ordered) {
    const id = change.controllerId.toLowerCase() as Hex;
    const current = rows.get(id);
    if (change.kind === 'registered') {
      rows.set(id, {
        id, name: change.name ?? current?.name ?? id, eoa: change.eoa.toLowerCase() as Hex, status: 'active',
        registeredAt: input.blockTimes.get(change.blockNumber) ?? null, registeredBlock: Number(change.blockNumber),
        registrationTx: change.txHash, revocationTx: null, sealed: 0, altered: input.watchRows ? 0 : null, deleted: input.watchRows ? 0 : null,
        breachesOnTime: 0, breachesLate: 0, openReports: input.openReports ? 0 : null, lastActivity: null,
      });
    } else if (current) {
      rows.set(id, { ...current, status: 'revoked', revocationTx: change.txHash });
    }
  }
  const row = (controllerId: string | undefined) => (controllerId ? rows.get(controllerId.toLowerCase()) : undefined);
  const last = new Map<string, Date | null>();
  for (const a of input.activity) {
    const r = row(a.controllerId);
    if (!r) continue;
    r.sealed = a.n;
    last.set(r.id, later(last.get(r.id), a.last));
  }
  for (const b of input.breaches) {
    const r = row(b.controllerId);
    if (!r) continue;
    if (b.mode === 'on_time') r.breachesOnTime += b.n; else r.breachesLate += b.n;
    last.set(r.id, later(last.get(r.id), b.last));
  }
  for (const o of input.openReports ?? []) {
    const r = row(o.controllerId);
    if (r) r.openReports = o.n;
  }
  // Watch names a DELETED row's controller by its registered name (or its id when Saksi has never stored it).
  const byName = new Map<string, string | null>();
  for (const r of rows.values()) byName.set(r.name, byName.has(r.name) ? null : r.id);
  for (const w of input.watchRows ?? []) {
    if (w.status !== 'ALTERED' && w.status !== 'DELETED') continue;
    const r = row((w.eventId && input.eventControllers.get(w.eventId)) || byName.get(w.controllerName) || (isHexId(w.controllerName) ? w.controllerName : undefined));
    if (!r) continue;
    if (w.status === 'ALTERED') r.altered = (r.altered ?? 0) + 1; else r.deleted = (r.deleted ?? 0) + 1;
  }
  for (const r of rows.values()) r.lastActivity = last.get(r.id)?.toISOString() ?? null;
  return [...rows.values()].sort((a, b) => (a.status === b.status ? (b.lastActivity ?? '').localeCompare(a.lastActivity ?? '') || a.registeredBlock - b.registeredBlock : a.status === 'active' ? -1 : 1));
}

type Scan = { changes: RegistryChange[]; head: bigint; at: number };
let cached: Scan | undefined;
const blockTimes = new Map<bigint, number>();

// Every registration and revocation since the deploy block. The deploy block is recent, so this is a few getLogs calls.
async function registryChanges(): Promise<Scan> {
  if (cached && Date.now() - cached.at < 30_000) return cached;
  const client = rpc();
  const registry = addresses().registry;
  const tip = await client.getBlockNumber();
  const head = tip > 0n ? tip - 1n : tip;
  const changes: RegistryChange[] = [];
  for (let fromBlock = deployBlock(); fromBlock <= head; fromBlock += 10_000n) {
    const toBlock = fromBlock + 9_999n < head ? fromBlock + 9_999n : head;
    const [registered, revoked] = await Promise.all([
      client.getLogs({ address: registry, event: events[3], fromBlock, toBlock, strict: true }),
      client.getLogs({ address: registry, event: events[4], fromBlock, toBlock, strict: true }),
    ]);
    for (const log of registered) {
      if (!log.removed) changes.push({ kind: 'registered', controllerId: log.args.controllerId, eoa: log.args.eoa, name: log.args.name,
        blockNumber: log.blockNumber, logIndex: log.logIndex, txHash: log.transactionHash });
    }
    for (const log of revoked) {
      if (!log.removed) changes.push({ kind: 'revoked', controllerId: log.args.controllerId, eoa: log.args.eoa,
        blockNumber: log.blockNumber, logIndex: log.logIndex, txHash: log.transactionHash });
    }
  }
  const missing = [...new Set(changes.filter((c) => c.kind === 'registered').map((c) => c.blockNumber))].filter((b) => !blockTimes.has(b));
  await Promise.all(missing.map(async (blockNumber) => {
    const block = await client.getBlock({ blockNumber }).catch(() => null);
    if (block) blockTimes.set(blockNumber, Number(block.timestamp));
  }));
  cached = { changes, head, at: Date.now() };
  return cached;
}

/** GET /api/regulator/controllers: the on-chain register of authorised controllers with live compliance numbers. */
export async function controllerRegister() {
  const database = db();
  const [scan, activity, breaches, openReports, integrity] = await Promise.all([
    registryChanges(),
    database.select({ controllerId: accessEvents.controllerId, n: sql<number>`count(*) filter (where ${accessEvents.status} = 'anchored')`.mapWith(Number),
      last: max(accessEvents.createdAt) }).from(accessEvents)
      // Pending rows are unsigned drafts anyone with a citizen code can create, so they are not controller activity.
      .where(inArray(accessEvents.status, ['submitted', 'anchored'])).groupBy(accessEvents.controllerId),
    database.select({ controllerId: breachReports.controllerId, mode: breachReports.mode, n: count(), last: max(breachReports.createdAt) })
      .from(breachReports).where(eq(breachReports.status, 'anchored')).groupBy(breachReports.controllerId, breachReports.mode),
    // Before the citizen_reports migration is applied the rest of the register still loads.
    openReportsByController().catch(() => null),
    watch().catch(() => null),
  ]);
  const watchRows = integrity ? integrity.rows.filter((r) => r.status === 'ALTERED' || r.status === 'DELETED') : null;
  const eventIds = (watchRows ?? []).flatMap((r) => (r.eventId ? [r.eventId] : []));
  const owners = eventIds.length
    ? await database.select({ id: accessEvents.id, controllerId: accessEvents.controllerId }).from(accessEvents).where(inArray(accessEvents.id, eventIds))
    : [];
  const controllers = aggregateControllers({
    changes: scan.changes, blockTimes, activity, breaches, openReports, watchRows,
    eventControllers: new Map(owners.map((o) => [o.id, o.controllerId])),
  });
  return {
    controllers, registry: addresses().registry, blockNumber: Number(scan.head),
    watch: integrity ? { blockNumber: integrity.blockNumber, checkedAt: integrity.checkedAt } : null,
    checkedAt: new Date().toISOString(),
  };
}
