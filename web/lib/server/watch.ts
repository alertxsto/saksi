import 'server-only';
import { eq } from 'drizzle-orm';
import type { AbiEvent, Hex, Log } from 'viem';
import { db } from '../../db/client';
import { accessEvents, controllers } from '../../db/schema';
import { evidenceHash, purposeHash } from '../shared/commit';
import { EVENT_TYPES, type ReceiptOpening, type WatchRow } from '../shared/types';
import { readOpening } from './access';
import { addresses, deployBlock, events, hash, rpc } from './chain';

type AccessLog = Log<bigint, number, false, typeof events[0], true, readonly [typeof events[0]], 'AccessLogged'>;
type Cursor = { next: bigint; logs: AccessLog[] };
const windows = new Map<string, Cursor>();
const emptyHash = `0x${'00'.repeat(32)}` as Hex;
const rank = { ALTERED: 0, DELETED: 1, NOT_ANCHORED: 2, MATCH: 3 } as const;
const key = (tx: string | null, index: number | null) => `${tx?.toLowerCase()}:${index}`;

export function compareOpening(opening: ReceiptOpening, args: AccessLog['args']) {
  const checks: [string, string, string][] = [
    ['controllerId', opening.controllerId, args.controllerId],
    ['eventType', EVENT_TYPES[opening.eventType], EVENT_TYPES[args.eventType] ?? String(args.eventType)],
    ['legalBasis', opening.legalBasisKey, args.legalBasisKey],
    ['pseudonym', opening.subjectPseudonym, args.subjectPseudonym],
    ['purpose', purposeHash(opening.purposeText, opening.purposeSalt), args.purposeHash],
    ['evidence', evidenceHash(opening.evidence), args.evidenceHash],
  ];
  const difference = checks.find(([, stored, anchored]) => stored.toLowerCase() !== anchored.toLowerCase());
  return difference ? { field: difference[0], dbValue: difference[1], chainValue: difference[2] } : undefined;
}

async function scan(controllerId?: Hex) {
  const client = rpc();
  if (await client.getChainId() !== 11155111) throw new Error('Expected Sepolia.');
  const [head, first, journal] = [await client.getBlockNumber(), deployBlock(), addresses().journal];
  const scope = `${journal}:${first}:${controllerId ?? '*'}`;
  const previous = windows.get(scope);
  // Cache only older blocks; re-read the recent tip so shallow reorgs cannot stick.
  const stable = head >= 12n ? head - 12n : 0n;
  const cached = previous && previous.next <= stable + 1n ? previous : { next: first, logs: [] };
  const logs = [...cached.logs];
  let stableCount = logs.length;
  for (let fromBlock = cached.next; fromBlock <= head;) {
    const end = fromBlock + 9_999n;
    const boundary = fromBlock <= stable ? stable : head;
    const toBlock = end < boundary ? end : boundary;
    logs.push(...await client.getLogs({ address: journal, event: events[0] satisfies AbiEvent,
      args: controllerId && { controllerId }, fromBlock, toBlock, strict: true }));
    if (toBlock <= stable) stableCount = logs.length;
    fromBlock = toBlock + 1n;
  }
  if (windows.size >= 32 && !windows.has(scope)) windows.delete(windows.keys().next().value!);
  windows.set(scope, { next: stable >= first ? stable + 1n : first, logs: logs.slice(0, stableCount) });
  return { logs, head };
}

export async function watch(controllerId?: Hex) {
  const [{ logs, head }, records, orgs] = await Promise.all([
    scan(controllerId),
    db().select({ row: accessEvents, name: controllers.name }).from(accessEvents)
      .innerJoin(controllers, eq(accessEvents.controllerId, controllers.id))
      .where(controllerId ? eq(accessEvents.controllerId, controllerId) : undefined),
    db().select({ id: controllers.id, name: controllers.name }).from(controllers),
  ]);
  const byEvent = new Map(records.filter(({ row }) => row.txHash !== null && row.logIndex !== null)
    .map((record) => [key(record.row.txHash, record.row.logIndex), record]));
  const submitted = new Map(records.filter(({ row }) => row.status === 'submitted' && row.txHash !== null && row.logIndex === null)
    .map((record) => [`${record.row.txHash}:${record.row.controllerId}:${record.row.evidenceHash}`, record]));
  const seenTransactions = new Set<string>();
  const names = new Map(orgs.map(({ id, name }) => [id, name]));
  const rows: WatchRow[] = logs.map((log) => {
    seenTransactions.add(log.transactionHash.toLowerCase());
    const record = byEvent.get(key(log.transactionHash, log.logIndex))
      ?? submitted.get(`${log.transactionHash}:${log.args.controllerId}:${log.args.evidenceHash}`);
    const base = { txHash: log.transactionHash, logIndex: log.logIndex, blockNumber: Number(log.blockNumber) };
    if (!record) return { ...base, eventId: null, controllerName: names.get(log.args.controllerId) ?? log.args.controllerId, status: 'DELETED' };
    let difference: ReturnType<typeof compareOpening>;
    try { difference = compareOpening(readOpening(record.row, record.name), log.args); }
    catch { difference = { field: 'opening', dbValue: 'Unreadable', chainValue: 'Recorded commitment' }; }
    return { ...base, eventId: record.row.id, controllerName: record.name,
      ...(difference ? { status: 'ALTERED' as const, ...difference } : { status: 'MATCH' as const }) };
  });
  const cutoff = Date.now() - 120_000;
  for (const { row, name } of records) {
    if ((row.status === 'pending' || row.status === 'submitted') && row.createdAt.getTime() < cutoff &&
      (!row.txHash || !seenTransactions.has(row.txHash.toLowerCase()))) {
      rows.push({ eventId: row.id, txHash: row.txHash ? hash.parse(row.txHash) : emptyHash,
        logIndex: row.logIndex ?? -1, controllerName: name, status: 'NOT_ANCHORED' });
    }
  }
  rows.sort((a, b) => rank[a.status] - rank[b.status] || (b.blockNumber ?? 0) - (a.blockNumber ?? 0) || b.logIndex - a.logIndex);
  const stats = { MATCH: 0, ALTERED: 0, DELETED: 0, NOT_ANCHORED: 0 };
  for (const row of rows) stats[row.status]++;
  return { rows, stats, blockNumber: Number(head), checkedAt: new Date().toISOString() };
}
