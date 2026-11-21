import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { decodeEventLog } from 'viem';
import { z } from 'zod';
import { db } from '../../db/client';
import { aiRuns, breachReports as reports, controllers } from '../../db/schema';
import { affectedCountHash, reportHash } from '../shared/commit';
import type { BreachRow } from '../shared/types';
import { addresses, events, hash, receipt, rpc } from './chain';
import { decrypt, encrypt, randomSalt32 } from './crypto';
import { HttpError, missing } from './http';
import { controller } from './registry';
import { submitInput } from './access';
export const pasal46 = z.strictObject({ dataAffected: z.string().trim().min(1).max(1000), whenAndHow: z.string().trim().min(1).max(2000), actionsTaken: z.string().trim().min(1).max(2000), contact: z.string().trim().min(1).max(500) });
export const prepareBreachInput = z.strictObject({ controllerId: hash, fields: pasal46, detectedAt: z.int().nonnegative(), affectedCount: z.int().nonnegative(), aiRunId: z.uuid().optional() });
const windowSeconds = 72 * 3600;
export async function prepareBreach(data: z.output<typeof prepareBreachInput>) {
  await controller(data.controllerId);
  const head = await rpc().getBlock({ blockTag: 'latest' });
  const now = Number(head.timestamp), deadline = data.detectedAt + windowSeconds;
  if (data.detectedAt > now) throw new HttpError(400, 'FUTURE_DETECTION', 'Detection time cannot be in the future.');
  const [run] = data.aiRunId ? await db().select().from(aiRuns).where(and(eq(aiRuns.id, data.aiRunId), eq(aiRuns.feature, 'draft'))) : [];
  if (data.aiRunId && !run) throw new HttpError(404, 'AI_RUN_NOT_FOUND', 'Draft provenance was not found.');
  const id = randomUUID();
  const report = { v: 1, reportId: id, createdAt: new Date().toISOString(), nonce: randomSalt32(), controllerId: data.controllerId,
    detectedAtClaimed: data.detectedAt, pasal46: data.fields, ai: run ? { model: run.model, promptVersionHash: run.promptVersion, outputHash: run.outputHash } : null };
  const commitment = reportHash(report), salt = randomSalt32(), countHash = affectedCountHash(data.affectedCount, salt);
  const encrypted = encrypt(JSON.stringify(report)), count = encrypt(String(data.affectedCount)), countSalt = encrypt(salt);
  const mode = now <= deadline ? 'on_time' : 'late';
  await db().insert(reports).values({ id, controllerId: data.controllerId, reportJsonEnc: encrypted.ciphertext, reportIv: encrypted.iv, reportHash: commitment,
    affectedCountEnc: count.iv + '.' + count.ciphertext, countSaltEnc: countSalt.iv + '.' + countSalt.ciphertext, affectedCountHash: countHash,
    detectedAt: data.detectedAt, mode, aiRunId: data.aiRunId });
  return { id, args: [data.controllerId, commitment, countHash, data.detectedAt] as const, mode, deadline, hoursLeft: (deadline - now) / 3600 };
}
export async function submitBreach({ id, txHash }: z.output<typeof submitInput>) {
  const [row] = await db().update(reports).set({ status: 'submitted', txHash }).where(and(eq(reports.id, id), eq(reports.status, 'pending'), isNull(reports.txHash))).returning({ id: reports.id });
  if (row) return { status: 'submitted' };
  const [existing] = await db().select({ txHash: reports.txHash }).from(reports).where(eq(reports.id, id));
  if (!existing) throw missing();
  if (existing.txHash !== txHash) throw new HttpError(409, 'TX_ALREADY_SET', 'A different transaction is already set.');
  return { status: 'submitted' };
}
export async function confirmBreach(id: string) {
  const [row] = await db().select().from(reports).where(eq(reports.id, id));
  if (!row) throw missing();
  if (row.status === 'anchored') return { status: row.status, mode: row.mode, anchoredAt: row.anchoredAt, lateBySec: row.lateBySec };
  if (row.status === 'failed') return { status: row.status, reason: 'The breach transaction did not match the draft.' };
  if (!row.txHash) throw new HttpError(409, 'TX_NOT_SET', 'Submit a transaction hash first.');
  const observed = await receipt(hash.parse(row.txHash));
  if (!observed) return { status: 'submitted' };
  const target = addresses().breach;
  const condition = and(eq(reports.id, id), eq(reports.status, 'submitted'), eq(reports.txHash, row.txHash));
  const matching = observed.status === 'success' && observed.to?.toLowerCase() === target ? observed.logs.flatMap((log) => {
    if (log.address.toLowerCase() !== target || log.removed) return [];
    try {
      const event = decodeEventLog({ abi: [events[1], events[2]], data: log.data, topics: log.topics });
      const a = event.args;
      if (a.controllerId !== row.controllerId || a.reportHash !== row.reportHash || a.affectedCountHash !== row.affectedCountHash || a.detectedAt !== BigInt(row.detectedAt)) return [];
      return [{ event, index: log.logIndex }];
    } catch { return []; }
  }) : [];
  const block = matching.length === 1 ? await rpc().getBlock({ blockHash: observed.blockHash }) : undefined;
  if (!block || block.timestamp !== matching[0].event.args.anchoredAt) {
    await db().update(reports).set({ status: 'failed' }).where(condition);
    return { status: 'failed', reason: observed.status === 'reverted' ? 'The transaction reverted.' : 'The breach event does not match the draft.' };
  }
  const { event, index } = matching[0];
  const mode = event.eventName === 'BreachAnchored' ? 'on_time' : 'late';
  const lateBySec = event.eventName === 'LateBreachAnchored' ? Number(event.args.lateBy) : 0;
  const anchoredAt = Number(event.args.anchoredAt);
  await db().update(reports).set({ status: 'anchored', mode, anchoredAt, lateBySec, logIndex: index }).where(condition);
  return { status: 'anchored', mode, anchoredAt, lateBySec };
}
function view(row: typeof reports.$inferSelect, controllerName: string): BreachRow {
  return { id: row.id, controllerName, title: 'Synthetic breach report', detectedAt: row.detectedAt, anchoredAt: row.anchoredAt,
    mode: row.mode, lateBySec: row.lateBySec ?? 0, hoursUsed: row.anchoredAt === null ? 0 : (row.anchoredAt - row.detectedAt) / 3600,
    txHash: row.txHash && hash.parse(row.txHash) || null, status: row.status };
}
export async function listBreaches() {
  const data = await db().select({ row: reports, name: controllers.name }).from(reports).innerJoin(controllers, eq(reports.controllerId, controllers.id)).orderBy(desc(reports.createdAt));
  const rows = data.map(({ row, name }) => view(row, name));
  const anchored = rows.filter((row) => row.status === 'anchored');
  return { rows, stats: { total: rows.length, onTime: anchored.filter((row) => row.mode === 'on_time').length, late: anchored.filter((row) => row.mode === 'late').length } };
}
export async function breachDetails(id: string) {
  const [item] = await db().select({ row: reports, name: controllers.name }).from(reports).innerJoin(controllers, eq(reports.controllerId, controllers.id)).where(eq(reports.id, id));
  if (!item) throw missing();
  const report = z.object({ pasal46, ai: z.object({ model: z.string(), promptVersionHash: hash, outputHash: hash }).nullable() }).parse(JSON.parse(decrypt(item.row.reportJsonEnc, item.row.reportIv)));
  return { ...view(item.row, item.name), ...report, discoveryAt: item.row.detectedAt, deadline: item.row.detectedAt + windowSeconds };
}
