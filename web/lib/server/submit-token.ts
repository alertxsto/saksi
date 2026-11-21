import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { HttpError } from './http';

// Prepare hands the caller a token bound to the draft id; submit requires it, so knowing a draft id
// (for example from the controller's recent list) is not enough to attach a transaction hash to it.
// The token is an HMAC of the id, so nothing extra is stored in the database.
export type DraftResource = 'access' | 'breach';
export const submitTokenFormat = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('SESSION_SECRET must contain at least 32 bytes.');
  return createHmac('sha256', secret).update('saksi submit token v1').digest();
}
export function submitToken(resource: DraftResource, id: string) {
  return createHmac('sha256', key()).update(`${resource}:${id.toLowerCase()}`).digest('base64url');
}
export function requireSubmitToken(resource: DraftResource, id: string, supplied: string) {
  const expected = Buffer.from(submitToken(resource, id));
  const given = Buffer.from(supplied);
  if (given.length !== expected.length || !timingSafeEqual(expected, given)) {
    throw new HttpError(403, 'SUBMIT_TOKEN_INVALID', 'This draft was prepared in another session. Prepare the transaction again.');
  }
}
