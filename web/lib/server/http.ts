import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
export const missing = () => new HttpError(404, 'NOT_FOUND', 'Record not found.');
export const json = (value: unknown, status = 200) => new Response(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
// Request validation fails with a 400 here, so any ZodError that reaches the route handler comes from
// server configuration or stored data and is reported as 503 instead of blaming the client.
export function validate<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const fields = [...new Set(parsed.error.issues.map(({ path }) => path.map(String).join('.')).filter(Boolean))].slice(0, 3);
  throw new HttpError(400, 'INVALID_INPUT', fields.length ? `Please check the submitted values (${fields.join(', ')}).` : 'Please check the submitted values.');
}
export async function input<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  if (!request.headers.get('content-type')?.startsWith('application/json') || !request.body) throw new HttpError(400, 'INVALID_INPUT', 'Expected a JSON body.');
  const reader = request.body.getReader();
  const bytes = new Uint8Array(32_768);
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (length + value.length > bytes.length) { await reader.cancel(); throw new HttpError(413, 'TOO_LARGE', 'Request is too large.'); }
      bytes.set(value, length);
      length += value.length;
    }
  } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length))); }
  catch { throw new HttpError(400, 'INVALID_INPUT', 'Request body is not valid JSON.'); }
  return validate(schema, body);
}
// Rate-limit key. Only headers our own proxy sets are trusted: x-vercel-forwarded-for on Vercel (VERCEL=1), and on
// the VM the X-Real-IP that Caddy sets from the TCP peer (deploy/Caddyfile.saksi; the container port is bound to
// 127.0.0.1). The fallback is the rightmost X-Forwarded-For entry, the one appended by the nearest proxy; the
// leftmost entries are whatever the client sent.
export function clientIp(request: Request) {
  const vercel = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() : undefined;
  const real = request.headers.get('x-real-ip')?.trim();
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  return vercel || real || forwarded || 'local';
}
// Browsers send Origin on cross-site POST/DELETE. Accept it only when it is the origin this request was addressed to:
// the forwarded (or direct) host and scheme, or NEXT_PUBLIC_SITE_URL. Requests without Origin (curl, scripts) pass.
const originOf = (value: string | undefined) => { try { return value ? new URL(value).origin : undefined; } catch { return undefined; } };
export function sameOrigin(request: Request) {
  const supplied = request.headers.get('origin');
  if (supplied === null) return true;
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host') || url.host;
  const scheme = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || url.protocol.replace(/:$/, '');
  const origin = originOf(supplied);
  return origin !== undefined && [originOf(`${scheme}://${host}`), originOf(process.env.NEXT_PUBLIC_SITE_URL)].includes(origin);
}
// Browsers drop Secure cookies set over plain http, so follow the scheme the browser used.
// COOKIE_SECURE=true|false overrides the detection (e.g. when a proxy does not send x-forwarded-proto).
export function secureCookies(request: Request) {
  const forced = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (forced === 'true' || forced === 'false') return forced === 'true';
  const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  return (forwarded || new URL(request.url).protocol.replace(/:$/, '')) === 'https';
}
// One log line per unexpected failure: error names, messages and the top stack, never request bodies.
// Query errors list their bound parameters after "params:", which can carry submitted values, so drop them.
export function describeError(error: unknown): string {
  const parts: string[] = [];
  let stack: string | undefined;
  for (let current = error, depth = 0; current !== undefined && current !== null && depth < 5; depth++) {
    // Zod 4 errors are not `instanceof Error`, so accept any object with a string name and message.
    const item = current as { name?: unknown; message?: unknown; stack?: unknown; cause?: unknown };
    if (typeof current === 'object' && typeof item.message === 'string') {
      // V8 repeats the (possibly multi-line) message at the top of `stack`; keep only the frames.
      if (typeof item.stack === 'string') stack ??= item.stack.split('\n').filter((line) => /^\s+at /.test(line)).slice(0, 5).join('\n');
      const message = item.message.replace(/\s*params:[\s\S]*$/, ' params: [redacted]').slice(0, 1_000);
      parts.push(`${typeof item.name === 'string' ? item.name : 'Error'}: ${message}`);
      current = item.cause;
    } else {
      parts.push(String(current).slice(0, 200));
      break;
    }
  }
  return [parts.join(' <- caused by '), stack].filter(Boolean).join('\n');
}
export function requireDemoToken(request: Request) {
  const configured = process.env.DEMO_ADMIN_TOKEN;
  const provided = request.headers.get('x-demo-token');
  if (!configured || !provided || Buffer.byteLength(configured) !== Buffer.byteLength(provided) || !timingSafeEqual(Buffer.from(configured), Buffer.from(provided))) {
    throw new HttpError(403, 'FORBIDDEN', 'A valid admin token is required.');
  }
}
