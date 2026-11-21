import 'server-only';
import { and, count, desc, eq } from 'drizzle-orm';
import { decodeEventLog, keccak256, stringToHex, verifyMessage, type Hex } from 'viem';
import { z } from 'zod';
import { db } from '../../db/client';
import { accessEvents, citizenReports, controllers, subjects } from '../../db/schema';
import { registryAbi } from '../shared/abi';
import { REPORT_NOTE_MAX, REPORT_REASONS, REVIEW_WINDOW_MS, reviewMessage, type ReportReason, type ReportVerdict } from '../shared/report-message';
import { EVENT_TYPES, type EventTypeName } from '../shared/types';
import { verifyReceipt } from '../shared/verify';
import { readOpening, type AccessRow } from './access';
import { addresses, events, hash, receipt, rpc } from './chain';
import { decrypt, pseudonym } from './crypto';
import { HttpError, missing } from './http';
import { consume } from './rate-limit';
import { controller } from './registry';
import { maskCode } from './stats';

export const reportInput = z.strictObject({
  eventId: z.uuid(),
  reason: z.enum(REPORT_REASONS),
  note: z.string().trim().max(REPORT_NOTE_MAX).nullish().transform((value) => value || null),
  // Only for a receipt Saksi's store no longer returns: the chain position the citizen's phone kept.
  chain: z.strictObject({ txHash: hash, logIndex: z.number().int().min(0).max(1_000_000) }).optional(),
});
export const reviewInput = z.strictObject({
  id: z.uuid(),
  signedAt: z.iso.datetime(),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/).transform((value) => value as Hex),
});

type EventRecord = { row: AccessRow; controllerName: string };
type ChainAccess = { controllerId: Hex; subjectPseudonym: Hex; eventType: number; timestamp: bigint };
export type NewReport = typeof citizenReports.$inferInsert;
export type ReportStore = {
  limit(key: string, perMinute: number): Promise<boolean>;
  eventById(id: string): Promise<EventRecord | undefined>;
  eventByLog(txHash: Hex, logIndex: number): Promise<EventRecord | undefined>;
  subjectSalt(subjectId: string): Promise<Hex | undefined>;
  chainLog(txHash: Hex, logIndex: number): Promise<ChainAccess | null>;
  verify(record: EventRecord): Promise<ReportVerdict>;
  insert(values: NewReport): Promise<{ id: string; createdAt: Date } | undefined>;
};

const selectEvent = () => db().select({ row: accessEvents, controllerName: controllers.name }).from(accessEvents)
  .innerJoin(controllers, eq(accessEvents.controllerId, controllers.id));

export const reportStore: ReportStore = {
  limit: consume,
  async eventById(id) { return (await selectEvent().where(eq(accessEvents.id, id)))[0]; },
  async eventByLog(txHash, logIndex) {
    return (await selectEvent().where(and(eq(accessEvents.txHash, txHash), eq(accessEvents.logIndex, logIndex))))[0];
  },
  async subjectSalt(subjectId) {
    const [subject] = await db().select().from(subjects).where(eq(subjects.id, subjectId));
    return subject?.pseudonymSaltEnc && subject.pseudonymSaltIv ? hash.parse(decrypt(subject.pseudonymSaltEnc, subject.pseudonymSaltIv)) : undefined;
  },
  async chainLog(txHash, logIndex) {
    const journal = addresses().journal;
    const observed = await receipt(txHash);
    const log = observed?.status === 'success' ? observed.logs.find((entry) => entry.logIndex === logIndex) : undefined;
    if (!log || log.removed || log.address.toLowerCase() !== journal) return null;
    try {
      const { args } = decodeEventLog({ abi: [events[0]], data: log.data, topics: log.topics });
      // The report row references controllers; this stores a registered controller Saksi has not seen yet.
      await controller(args.controllerId);
      return { controllerId: args.controllerId, subjectPseudonym: args.subjectPseudonym, eventType: args.eventType, timestamp: args.timestamp };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      return null;
    }
  },
  // The same check the AI explain route uses: the server reads the chain itself and never takes the browser's word.
  async verify({ row, controllerName }) {
    let opening;
    try { opening = readOpening(row, controllerName); } catch { return 'ALTERED'; }
    try {
      const { status } = await verifyReceipt(opening);
      return status === 'MATCH' ? 'MATCH' : status === 'MISMATCH' ? 'ALTERED' : 'NOT_FOUND';
    } catch { return 'NOT_FOUND'; }
  },
  async insert(values) {
    const [row] = await db().insert(citizenReports).values(values).onConflictDoNothing()
      .returning({ id: citizenReports.id, createdAt: citizenReports.createdAt });
    return row;
  },
};

/**
 * The report id of a receipt Saksi's store no longer has, derived from its proven chain position and never from the
 * browser: dedup is keyed on the chain event and one citizen cannot take another's event id first.
 */
export function chainEventId(txHash: Hex, logIndex: number) {
  const h = keccak256(stringToHex(`${txHash.toLowerCase()}:${logIndex}`)).slice(2, 34);
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * A citizen reports one of their own receipts to the regulator. The verdict stored with the report is computed here
 * against the chain. A receipt that no longer exists in Saksi's store can still be reported from the chain position
 * the citizen's phone kept: ownership is then proven by recomputing the citizen's pseudonym for that controller.
 */
export async function createReport(subjectId: string, input: z.output<typeof reportInput>, ip: string, store: ReportStore = reportStore) {
  if (!await store.limit(`report:${subjectId}`, 5) || !await store.limit(`report-ip:${ip}`, 20)) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many reports. Wait a minute and try again.');
  }
  let record = await store.eventById(input.eventId);
  let snapshot: Pick<NewReport, 'eventId' | 'controllerId' | 'eventType' | 'txHash' | 'logIndex' | 'sealedAt'> | undefined;
  let serverVerdict: ReportVerdict | undefined;
  if (!record && input.chain) {
    const log = await store.chainLog(input.chain.txHash, input.chain.logIndex);
    const salt = log && await store.subjectSalt(subjectId);
    if (!log || !salt || pseudonym(log.controllerId, subjectId, salt).toLowerCase() !== log.subjectPseudonym.toLowerCase()) throw missing();
    record = await store.eventByLog(input.chain.txHash, input.chain.logIndex);
    if (!record) {
      serverVerdict = 'DELETED';
      snapshot = { eventId: chainEventId(input.chain.txHash, input.chain.logIndex), controllerId: log.controllerId, eventType: log.eventType,
        txHash: input.chain.txHash, logIndex: input.chain.logIndex, sealedAt: Number(log.timestamp) };
    }
  }
  if (record) {
    // Someone else's receipt answers exactly like a missing one.
    if (record.row.subjectId !== subjectId) throw missing();
    serverVerdict = await store.verify(record);
    const { row } = record;
    snapshot = { eventId: row.id, controllerId: row.controllerId, eventType: row.eventType, txHash: row.txHash, logIndex: row.logIndex, sealedAt: row.blockTime };
  }
  if (!snapshot || !serverVerdict) throw missing();
  const saved = await store.insert({ ...snapshot, subjectId, reason: input.reason, note: input.note, serverVerdict });
  if (!saved) throw new HttpError(409, 'ALREADY_REPORTED', 'You already sent this report. The regulator has it.');
  return { id: saved.id, status: 'open' as const, reason: input.reason, serverVerdict, createdAt: saved.createdAt.toISOString() };
}

export type RegulatorReport = {
  id: string; reason: ReportReason; note: string | null; controllerId: string; controllerName: string; eventType: EventTypeName;
  citizenMasked: string; serverVerdict: ReportVerdict; status: 'open' | 'reviewed'; createdAt: string; sealedAt: number | null;
  txHash: string | null; logIndex: number | null; reviewedAt: string | null; reviewedBy: string | null;
};
type StoredReport = { report: typeof citizenReports.$inferSelect; controllerName: string; code: string | null };

/** What the regulator sees: no purpose text, no pseudonym, the citizen code masked like /api/stats. */
export function toRegulatorReport({ report, controllerName, code }: StoredReport): RegulatorReport {
  return {
    id: report.id, reason: report.reason, note: report.note, controllerId: report.controllerId, controllerName,
    eventType: EVENT_TYPES[report.eventType] ?? 'READ', citizenMasked: maskCode(code),
    serverVerdict: report.serverVerdict as ReportVerdict, status: report.status, createdAt: report.createdAt.toISOString(),
    sealedAt: report.sealedAt, txHash: report.txHash, logIndex: report.logIndex,
    reviewedAt: report.reviewedAt?.toISOString() ?? null, reviewedBy: report.reviewedBy,
  };
}

export async function listReports() {
  const [rows, totals] = await Promise.all([
    // A citizen who deleted their profile leaves the report without a subject; the masked code then shows as unknown.
    db().select({ report: citizenReports, controllerName: controllers.name, code: subjects.code }).from(citizenReports)
      .innerJoin(controllers, eq(citizenReports.controllerId, controllers.id)).leftJoin(subjects, eq(citizenReports.subjectId, subjects.id))
      .orderBy(desc(citizenReports.createdAt)).limit(200),
    db().select({ status: citizenReports.status, n: count() }).from(citizenReports).groupBy(citizenReports.status),
  ]);
  const counts = { open: 0, reviewed: 0 };
  for (const { status, n } of totals) counts[status] = n;
  return { reports: rows.map(toRegulatorReport), counts };
}

export async function openReportsByController() {
  return db().select({ controllerId: citizenReports.controllerId, n: count() }).from(citizenReports)
    .where(eq(citizenReports.status, 'open')).groupBy(citizenReports.controllerId);
}

// `admin` is immutable in ControllerRegistry, so one read per registry address is enough.
const admins = new Map<string, Hex>();
export async function registryAdmin(): Promise<Hex> {
  const registry = addresses().registry;
  const known = admins.get(registry);
  if (known) return known;
  const admin = (await rpc().readContract({ address: registry, abi: registryAbi, functionName: 'admin' })).toLowerCase() as Hex;
  admins.set(registry, admin);
  return admin;
}

type ReviewDeps = {
  admin(): Promise<Hex>;
  mark(id: string, reviewer: Hex, at: Date): Promise<{ status: 'open' | 'reviewed'; reviewedAt: Date | null; reviewedBy: string | null } | undefined>;
};
const reviewDeps: ReviewDeps = {
  admin: registryAdmin,
  async mark(id, reviewer, at) {
    const [updated] = await db().update(citizenReports).set({ status: 'reviewed', reviewedAt: at, reviewedBy: reviewer })
      .where(and(eq(citizenReports.id, id), eq(citizenReports.status, 'open')))
      .returning({ status: citizenReports.status, reviewedAt: citizenReports.reviewedAt, reviewedBy: citizenReports.reviewedBy });
    if (updated) return updated;
    const [existing] = await db().select({ status: citizenReports.status, reviewedAt: citizenReports.reviewedAt, reviewedBy: citizenReports.reviewedBy })
      .from(citizenReports).where(eq(citizenReports.id, id));
    return existing;
  },
};

/**
 * Marking a report reviewed needs an EIP-191 signature from the ControllerRegistry admin, read from the contract.
 * The signed message names the report and a time, so a signature works for one report and goes stale after 5 minutes.
 */
export async function reviewReport({ id, signedAt, signature }: z.output<typeof reviewInput>, now = Date.now(), deps: ReviewDeps = reviewDeps) {
  const signed = Date.parse(signedAt);
  if (!Number.isFinite(signed) || now - signed > REVIEW_WINDOW_MS || signed - now > 60_000) {
    throw new HttpError(401, 'STALE_SIGNATURE', 'The signature has expired. Sign again to mark this report reviewed.');
  }
  const admin = await deps.admin();
  const valid = await verifyMessage({ address: admin, message: reviewMessage(id, signedAt), signature }).catch(() => false);
  if (!valid) throw new HttpError(403, 'NOT_REGISTRY_ADMIN', 'Only the registry admin wallet can mark reports reviewed.');
  const result = await deps.mark(id, admin, new Date(now));
  if (!result) throw missing();
  return { id, status: result.status, reviewedAt: result.reviewedAt?.toISOString() ?? null, reviewedBy: result.reviewedBy };
}
