import 'server-only';
import { randomInt } from 'node:crypto';
import { fakerID_ID } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { controllers, subjects } from '../../db/schema';
import { confirmAccess, loadCitizenRows, readOpening, unlinkCitizen } from './access';
import { hash } from './chain';
import { decrypt, encrypt, pseudonym, randomSalt32 } from './crypto';
import { HttpError } from './http';
import { consume } from './rate-limit';
import { clearSession, readSession, setSession } from './session';
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const nextCheck = new Map<string, number>();
export async function createCitizen(ip: string, secureCookie: boolean) {
  if (!await consume(ip, 30)) throw new HttpError(429, 'RATE_LIMITED', 'Please wait before creating another profile.');
  const encrypted = encrypt(randomSalt32());
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    const [row] = await db().insert(subjects).values({ code, displayName: fakerID_ID.person.fullName(), pseudonymSaltEnc: encrypted.ciphertext, pseudonymSaltIv: encrypted.iv })
      .onConflictDoNothing({ target: subjects.code }).returning({ id: subjects.id, code: subjects.code, displayName: subjects.displayName });
    if (row) { await setSession(row.id, secureCookie); return { code: row.code, displayName: row.displayName }; }
  }
  throw new HttpError(503, 'CODE_UNAVAILABLE', 'Could not allocate a profile code. Try again.');
}
export async function citizenId() {
  const id = await readSession();
  if (!id) throw new HttpError(401, 'SESSION_REQUIRED', 'Create a citizen profile first.');
  return id;
}
export async function citizenReceipts() {
  const id = await citizenId();
  const [subject] = await db().select().from(subjects).where(eq(subjects.id, id));
  if (!subject?.pseudonymSaltEnc || !subject.pseudonymSaltIv) throw new HttpError(401, 'SESSION_REQUIRED', 'Create a citizen profile first.');
  const salt = hash.parse(decrypt(subject.pseudonymSaltEnc, subject.pseudonymSaltIv));
  const orgs = await db().select({ id: controllers.id }).from(controllers);
  const pseudonyms = orgs.map((org) => { const controllerId = hash.parse(org.id); return { controllerId, pseudonym: pseudonym(controllerId, id, salt) }; });
  const rows = await loadCitizenRows(id);
  const now = Date.now();
  for (const [rowId, expiry] of nextCheck) if (expiry <= now) nextCheck.delete(rowId);
  const checks = rows.filter(({ row }) => row.status === 'submitted' && !nextCheck.has(row.id));
  for (const { row } of checks) nextCheck.set(row.id, now + 3000);
  const checked = await Promise.allSettled(checks.map(({ row }) => confirmAccess(row.id)));
  const changed = checked.some((result) => result.status === 'fulfilled' && result.value.status !== 'submitted');
  return { receipts: (changed ? await loadCitizenRows(id) : rows).map(({ row, controllerName }) => readOpening(row, controllerName)), pseudonyms,
    profile: { code: subject.code, displayName: subject.displayName } };
}
export async function deleteCitizen() {
  const id = await readSession();
  if (id) await unlinkCitizen(id);
  await clearSession();
}
