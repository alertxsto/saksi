import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { decodeEventLog, hexToString, type Hex } from 'viem';
import { z } from 'zod';
import { db } from '../../db/client';
import { accessEvents as logs, controllers, subjects } from '../../db/schema';
import { evidenceHash, legalBasisKey, purposeHash } from '../shared/commit';
import { EVENT_TYPES, LEGAL_BASES, type ReceiptOpening } from '../shared/types';
import { accessAbi } from '../shared/abi';
import { addresses, blockByHash, events, hash, receipt, unknownTransaction, verifySubmission } from './chain';
import { decrypt, encrypt, pseudonym, randomSalt32 } from './crypto';
import { HttpError, missing } from './http';
import { controller } from './registry';
import { requireSubmitToken, submitToken, submitTokenFormat } from './submit-token';

export const citizenCode = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/);
export const accessInput = z.strictObject({ controllerId: hash, subjectCode: citizenCode, purposeText: z.string().trim().min(1).max(500), legalBasisKey: z.enum(Object.keys(LEGAL_BASES) as (keyof typeof LEGAL_BASES)[]), eventType: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]) });
export const submitInput = z.strictObject({ id: z.uuid(), txHash: hash, submitToken: submitTokenFormat });
export const confirmInput = z.strictObject({ id: z.uuid() });
export type AccessRow = typeof logs.$inferSelect;
export function readOpening(row: AccessRow, controllerName: string): ReceiptOpening {
  const purpose = decrypt(row.purposeTextEnc, row.encIv);
  const [saltIv, saltEnc] = row.purposeSaltEnc.split('.');
  return {
    eventId: row.id, controllerId: hash.parse(row.controllerId), controllerName, subjectPseudonym: hash.parse(row.subjectPseudonym), purposeText: purpose,
    purposeSalt: hash.parse(decrypt(saltEnc, saltIv)), legalBasisKey: hash.parse(row.legalBasisKey), eventType: accessInput.shape.eventType.parse(row.eventType),
    evidence: z.record(z.string(), z.unknown()).parse(JSON.parse(decrypt(row.evidenceEnc, row.evidenceIv))),
    txHash: row.txHash && hash.parse(row.txHash) || null, logIndex: row.logIndex, status: row.status, createdAt: row.createdAt.toISOString(),
  };
}
export async function prepareAccess(input: z.output<typeof accessInput>) {
  const [subject] = await db().select().from(subjects).where(and(eq(subjects.code, input.subjectCode), isNotNull(subjects.pseudonymSaltEnc)));
  if (!subject?.pseudonymSaltEnc || !subject.pseudonymSaltIv) throw new HttpError(404, 'UNKNOWN_CITIZEN', "We couldn't find that citizen code");
  await controller(input.controllerId);
  const id = randomUUID(), salt = randomSalt32();
  const subjectPseudonym = pseudonym(input.controllerId, subject.id, hash.parse(decrypt(subject.pseudonymSaltEnc, subject.pseudonymSaltIv)));
  const purpose = purposeHash(input.purposeText, salt), basis = legalBasisKey(input.legalBasisKey);
  const evidence = { v: 1, eventId: id, nonce: randomSalt32(), controllerId: input.controllerId, system: 'core-banking',
    dataCategories: [['account profile'], ['contact preferences'], ['transaction history'], ['account profile', 'account activity']][input.eventType], operatorRef: 'synthetic-operator', requestedAt: new Date().toISOString() };
  const commitment = evidenceHash(evidence);
  const encryptedPurpose = encrypt(input.purposeText), encryptedSalt = encrypt(salt), encryptedEvidence = encrypt(JSON.stringify(evidence));
  await db().insert(logs).values({ id, controllerId: input.controllerId, subjectId: subject.id, subjectPseudonym,
    purposeTextEnc: encryptedPurpose.ciphertext, purposeSaltEnc: encryptedSalt.iv + '.' + encryptedSalt.ciphertext, encIv: encryptedPurpose.iv,
    purposeHash: purpose, legalBasisKey: basis, eventType: input.eventType, evidenceEnc: encryptedEvidence.ciphertext, evidenceIv: encryptedEvidence.iv, evidenceHash: commitment });
  return { id, submitToken: submitToken('access', id), args: [input.controllerId, subjectPseudonym, purpose, basis, input.eventType, commitment] as const };
}
export async function submitAccess({ id, txHash, submitToken: token }: z.output<typeof submitInput>) {
  requireSubmitToken('access', id, token);
  const [draft] = await db().select().from(logs).where(eq(logs.id, id));
  if (!draft) throw missing();
  if (draft.status === 'pending' && draft.txHash === null) {
    await verifySubmission(txHash, addresses().journal, accessAbi, ['logAccess'],
      [hash.parse(draft.controllerId), draft.subjectPseudonym, draft.purposeHash, draft.legalBasisKey, draft.eventType, draft.evidenceHash]);
  }
  const [row] = await db().update(logs).set({ status: 'submitted', txHash }).where(and(eq(logs.id, id), eq(logs.status, 'pending'), isNull(logs.txHash))).returning({ id: logs.id });
  if (row) return { status: 'submitted' };
  const [existing] = await db().select({ txHash: logs.txHash }).from(logs).where(eq(logs.id, id));
  if (!existing) throw missing();
  if (existing.txHash !== txHash) throw new HttpError(409, 'TX_ALREADY_SET', 'A different transaction is already set.');
  return { status: 'submitted' };
}
export async function confirmAccess(id: string) {
  const [row] = await db().select().from(logs).where(eq(logs.id, id));
  if (!row) throw missing();
  if (row.status === 'anchored' || row.status === 'failed') return { status: row.status, ...(row.failReason && { reason: row.failReason }) };
  if (!row.txHash) throw new HttpError(409, 'TX_NOT_SET', 'Submit a transaction hash first.');
  const update = and(eq(logs.id, id), eq(logs.status, 'submitted'), eq(logs.txHash, row.txHash));
  const observed = await receipt(hash.parse(row.txHash));
  if (!observed) {
    if (!await unknownTransaction(row.txHash, row.createdAt)) return { status: 'submitted' };
    const reason = 'The transaction was not found on Sepolia.';
    await db().update(logs).set({ status: 'failed', failReason: reason }).where(update);
    return { status: 'failed', reason };
  }
  const journal = addresses().journal;
  const matches = observed.status === 'success' && observed.to?.toLowerCase() === journal ? observed.logs.filter((log) => {
    if (log.address.toLowerCase() !== journal || log.removed) return false;
    try {
      const { args } = decodeEventLog({ abi: [events[0]], data: log.data, topics: log.topics });
      return args.controllerId === row.controllerId && args.subjectPseudonym === row.subjectPseudonym && args.evidenceHash === row.evidenceHash &&
        args.purposeHash === row.purposeHash && args.legalBasisKey === row.legalBasisKey && args.eventType === row.eventType;
    } catch { return false; }
  }) : [];
  const block = matches.length === 1 ? await blockByHash(observed.blockHash) : undefined;
  if (block === null) return { status: 'submitted' };
  const expectedTime = block && decodeEventLog({ abi: [events[0]], data: matches[0].data, topics: matches[0].topics }).args.timestamp;
  if (!block || block.timestamp !== expectedTime) {
    const reason = observed.status === 'reverted' ? 'The transaction reverted.' : 'The journal event does not match the draft.';
    await db().update(logs).set({ status: 'failed', failReason: reason }).where(update);
    return { status: 'failed', reason };
  }
  await db().update(logs).set({ status: 'anchored', logIndex: matches[0].logIndex, blockNumber: Number(block.number), blockTime: Number(block.timestamp) }).where(update);
  return { status: 'anchored' };
}
export async function recentAccess(controllerId: Hex) {
  const rows = await db().select({ id: logs.id, eventType: logs.eventType, legalBasisKey: logs.legalBasisKey, status: logs.status, failReason: logs.failReason,
    txHash: logs.txHash, logIndex: logs.logIndex, blockNumber: logs.blockNumber, code: subjects.code, createdAt: logs.createdAt })
    .from(logs).leftJoin(subjects, eq(logs.subjectId, subjects.id)).where(eq(logs.controllerId, controllerId)).orderBy(desc(logs.createdAt)).limit(10);
  return { rows: rows.map(({ code, legalBasisKey: basis, ...row }) => {
    const key = hexToString(hash.parse(basis), { size: 32 });
    return { ...row, action: EVENT_TYPES[row.eventType], legalBasisKey: Object.hasOwn(LEGAL_BASES, key) ? key : null,
      // Controllers only see a masked hint, never the full citizen code. Two characters leave 32^4
      // candidates, which the per-IP prepare limit keeps out of reach of guessing.
      subjectCodeHint: code ? code.slice(0, 2) + '••••' : null };
  }) };
}
// Pending rows are unsigned drafts (a rejected or abandoned wallet prompt), not receipts, so citizens never see them.
export async function loadCitizenRows(id: string) {
  return db().select({ row: logs, controllerName: controllers.name }).from(logs).innerJoin(controllers, eq(logs.controllerId, controllers.id))
    .where(and(eq(logs.subjectId, id), ne(logs.status, 'pending'))).orderBy(desc(logs.createdAt));
}
export async function unlinkCitizen(id: string) {
  await db().execute(sql`with unlinked as (update access_events set subject_id = null where subject_id = ${id})
    update subjects set pseudonym_salt_enc = null, pseudonym_salt_iv = null where id = ${id}`);
}
