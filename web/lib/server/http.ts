import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
export const missing = () => new HttpError(404, 'NOT_FOUND', 'Record not found.');
export const json = (value: unknown, status = 200) => new Response(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
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
  return schema.parse(body);
}
export function requireDemoToken(request: Request) {
  const configured = process.env.DEMO_ADMIN_TOKEN;
  const provided = request.headers.get('x-demo-token');
  if (!configured || !provided || Buffer.byteLength(configured) !== Buffer.byteLength(provided) || !timingSafeEqual(Buffer.from(configured), Buffer.from(provided))) {
    throw new HttpError(403, 'FORBIDDEN', 'A valid demo token is required.');
  }
}
