import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
const name = 'saksi_sid';
// 30 days: there is no sign-in yet, so an expired cookie loses the citizen's receipts.
const lifetime = 30 * 86_400;
const payload = z.object({ id: z.uuid(), exp: z.number().int() });
function sign(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('SESSION_SECRET must contain at least 32 bytes.');
  return createHmac('sha256', secret).update(value).digest();
}
// `secure` must follow the scheme the browser used (see secureCookies in ./http): browsers drop
// Secure cookies set over plain http, which would break every citizen request after sign-up.
export async function setSession(id: string, secure: boolean) {
  const data = Buffer.from(JSON.stringify({ id, exp: Math.floor(Date.now() / 1000) + lifetime })).toString('base64url');
  (await cookies()).set(name, data + '.' + sign(data).toString('base64url'), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: lifetime, secure,
  });
}
export async function readSession(): Promise<string | undefined> {
  const value = (await cookies()).get(name)?.value;
  if (!value || !/^[a-zA-Z0-9_-]{1,256}[.][a-zA-Z0-9_-]{43}$/.test(value)) return;
  const [data, signature] = value.split('.');
  const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== 32 || !timingSafeEqual(sign(data), supplied)) return;
  try {
    const parsed = payload.safeParse(JSON.parse(Buffer.from(data, 'base64url').toString('utf8')));
    if (parsed.success && parsed.data.exp > Math.floor(Date.now() / 1000)) return parsed.data.id;
  } catch { return; }
}
export async function clearSession() { (await cookies()).delete(name); }
