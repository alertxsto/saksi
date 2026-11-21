import 'server-only';
import { eq } from 'drizzle-orm';
import type { AbiEvent, Hex, Log } from 'viem';
import { db } from '../../db/client';
import { accessEvents, controllers } from '../../db/schema';
import { controllerId as slugId, evidenceHash, purposeHash } from '../shared/commit';
import { EVENT_TYPES, type ReceiptOpening, type WatchRow } from '../shared/types';
import { readOpening } from './access';
import { addresses, deployBlock, events, hash, rpc } from './chain';
import { HttpError } from './http';
import { controller } from './registry';

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

// NOT_ANCHORED is for rows that claimed a transaction (submitted) which never reached the journal.
// Pending rows have no transaction hash: they are unsigned drafts from a rejected or abandoned wallet prompt.
export function isUnanchoredClaim(row: { status: string; txHash: string | null; createdAt: Date }, seenTransactions: ReadonlySet<string>, cutoff: number) {
  return row.status === 'submitted' && row.txHash !== null && row.createdAt.getTime() < cutoff && !seenTransactions.has(row.txHash.toLowerCase());
}

// An anchored row that no journal log backs: the database claims a seal the chain never recorded (a made-up or
// re-pointed row). Rows sealed in the newest block are skipped, since the scan stops one block behind the tip.
export function isPhantomSeal(row: { id: string; status: string; blockNumber: number | null }, matched: ReadonlySet<string>, head: number) {
  return row.status === 'anchored' && !matched.has(row.id) && (row.blockNumber === null || row.blockNumber <= head);
}

async function scan(controllerId?: Hex) {
  const client = rpc();
  if (await client.getChainId() !== 11155111) throw new Error('Expected Sepolia.');
  // One block behind the reported tip: the fallback transport may send getLogs to an RPC that is a block behind.
  const tip = await client.getBlockNumber();
  const [head, first, journal] = [tip > 0n ? tip - 1n : tip, deployBlock(), addresses().journal];
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

const demoControllers = new Set(['demo-one', 'demo-two', 'demo-spare'].map(slugId));
// A filtered scan costs RPC calls and a slot in the window cache, so only controllers Saksi knows get one.
// The demo controllers are inserted lazily on first use; for them registry.ts reads the registry once and stores the row.
export async function knownController(id: Hex) {
  const [row] = await db().select({ id: controllers.id }).from(controllers).where(eq(controllers.id, id));
  if (row) return;
  if (demoControllers.has(id)) { await controller(id); return; }
  throw new HttpError(404, 'UNKNOWN_CONTROLLER', 'Controller is not registered.');
}

export async function watch(controllerId?: Hex) {
  // Resolve the database client first: if it throws, the chain scan has not started and cannot reject unobserved.
  const database = db();
  if (controllerId) await knownController(controllerId);
  const [{ logs, head }, records, orgs] = await Promise.all([
    scan(controllerId),
    database.select({ row: accessEvents, name: controllers.name }).from(accessEvents)
      .innerJoin(controllers, eq(accessEvents.controllerId, controllers.id))
      .where(controllerId ? eq(accessEvents.controllerId, controllerId) : undefined),
    database.select({ id: controllers.id, name: controllers.name }).from(controllers),
  ]);
  const byEvent = new Map(records.filter(({ row }) => row.txHash !== null && row.logIndex !== null)
    .map((record) => [key(record.row.txHash, record.row.logIndex), record]));
  const submitted = new Map(records.filter(({ row }) => row.status === 'submitted' && row.txHash !== null && row.logIndex === null)
    .map((record) => [`${record.row.txHash}:${record.row.controllerId}:${record.row.evidenceHash}`, record]));
  // A wallet can seal an access whose submit never reached Saksi (closed tab): that row is still a pending draft with
  // no transaction hash. Matching it by controller and evidence keeps a real, sealed access from reading as DELETED.
  const drafts = new Map(records.filter(({ row }) => row.status === 'pending' && row.txHash === null)
    .map((record) => [`${record.row.controllerId.toLowerCase()}:${record.row.evidenceHash.toLowerCase()}`, record]));
  const matched = new Set<string>();
  const seenTransactions = new Set<string>();
  const names = new Map(orgs.map(({ id, name }) => [id, name]));
  const rows: WatchRow[] = logs.map((log) => {
    seenTransactions.add(log.transactionHash.toLowerCase());
    const record = byEvent.get(key(log.transactionHash, log.logIndex))
      ?? submitted.get(`${log.transactionHash}:${log.args.controllerId}:${log.args.evidenceHash}`)
      ?? drafts.get(`${log.args.controllerId.toLowerCase()}:${log.args.evidenceHash.toLowerCase()}`);
    const base = { txHash: log.transactionHash, logIndex: log.logIndex, blockNumber: Number(log.blockNumber) };
    if (!record) return { ...base, eventId: null, controllerName: names.get(log.args.controllerId) ?? log.args.controllerId, status: 'DELETED' };
    let difference: ReturnType<typeof compareOpening>;
    try { difference = compareOpening(readOpening(record.row, record.name), log.args); }
    catch { difference = { field: 'opening', dbValue: 'Unreadable', chainValue: 'Recorded commitment' }; }
    // Marking a sealed row as failed hides it from the citizen while every field still matches: the chain says it happened.
    if (!difference && record.row.status === 'failed') difference = { field: 'status', dbValue: 'failed', chainValue: 'anchored' };
    matched.add(record.row.id);
    return { ...base, eventId: record.row.id, controllerName: record.name,
      ...(difference ? { status: 'ALTERED' as const, ...difference } : { status: 'MATCH' as const }) };
  });
  const cutoff = Date.now() - 120_000;
  for (const { row, name } of records) {
    if (isUnanchoredClaim(row, seenTransactions, cutoff)) {
      rows.push({ eventId: row.id, txHash: row.txHash ? hash.parse(row.txHash) : emptyHash,
        logIndex: row.logIndex ?? -1, controllerName: name, status: 'NOT_ANCHORED' });
    } else if (isPhantomSeal(row, matched, Number(head))) {
      // A made-up row may carry a malformed hash; never let it take Watch down.
      rows.push({ eventId: row.id, txHash: hash.safeParse(row.txHash).data ?? emptyHash, logIndex: row.logIndex ?? -1,
        controllerName: name, status: 'NOT_ANCHORED', field: 'seal', dbValue: 'anchored', chainValue: 'No journal log' });
    }
  }
  rows.sort((a, b) => rank[a.status] - rank[b.status] || (b.blockNumber ?? 0) - (a.blockNumber ?? 0) || b.logIndex - a.logIndex);
  const stats = { MATCH: 0, ALTERED: 0, DELETED: 0, NOT_ANCHORED: 0 };
  for (const row of rows) stats[row.status]++;
  return { rows, stats, blockNumber: Number(head), checkedAt: new Date().toISOString() };
}
