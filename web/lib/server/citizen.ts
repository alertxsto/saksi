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

// Faker's Indonesian full names sometimes repeat a word ("Iriana Iriana Ananda"); drop the repeats.
export const dedupeWords = (name: string) => name.split(/\s+/).filter((w, i, all) => all.indexOf(w) === i).join(' ');
const syntheticName = () => dedupeWords(fakerID_ID.person.fullName());
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
type CheckState = Map<string, { due: number; delay: number; until: number }>;
const nextCheck: CheckState = new Map();
const CHECK_LIMIT = 3, FIRST_DELAY_MS = 3_000, MAX_DELAY_MS = 60_000, CHECK_WINDOW_MS = 15 * 60_000;
// The receipts poll (every 3 s per open inbox) re-checks submitted rows on chain. Bound the RPC work per request:
// at most the 3 newest due rows, each backing off 3 s, 6 s, 12 s ... up to 60 s, and none older than 15 minutes
// (confirm has marked an unknown transaction failed by then).
export function dueChecks<T extends { id: string; status: string; createdAt: Date }>(rows: readonly T[], state: CheckState = nextCheck, now = Date.now()): T[] {
  for (const [rowId, entry] of state) if (entry.until <= now) state.delete(rowId);
  const picked = rows.filter((row) => row.status === 'submitted' && now - row.createdAt.getTime() < CHECK_WINDOW_MS && (state.get(row.id)?.due ?? 0) <= now)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, CHECK_LIMIT);
  for (const row of picked) {
    const previous = state.get(row.id)?.delay;
    const delay = previous === undefined ? FIRST_DELAY_MS : Math.min(previous * 2, MAX_DELAY_MS);
    state.set(row.id, { due: now + delay, delay, until: row.createdAt.getTime() + CHECK_WINDOW_MS });
  }
  return picked;
}
export async function createCitizen(ip: string, secureCookie: boolean) {
  if (!await consume(ip, 30)) throw new HttpError(429, 'RATE_LIMITED', 'Please wait before creating another profile.');
  const encrypted = encrypt(randomSalt32());
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    const [row] = await db().insert(subjects).values({ code, displayName: syntheticName(), pseudonymSaltEnc: encrypted.ciphertext, pseudonymSaltIv: encrypted.iv })
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
  const checked = await Promise.allSettled(dueChecks(rows.map(({ row }) => row)).map((row) => confirmAccess(row.id)));
  const changed = checked.some((result) => result.status === 'fulfilled' && result.value.status !== 'submitted');
  return { receipts: (changed ? await loadCitizenRows(id) : rows).map(({ row, controllerName }) => readOpening(row, controllerName)), pseudonyms,
    profile: { code: subject.code, displayName: subject.displayName } };
}
export async function deleteCitizen() {
  const id = await readSession();
  if (id) await unlinkCitizen(id);
  await clearSession();
}
