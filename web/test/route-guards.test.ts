import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const consume = vi.fn();
vi.mock('../lib/server/rate-limit', () => ({ consume: (...args: unknown[]) => consume(...args) }));
const draft = vi.fn();
const explain = vi.fn();
vi.mock('../lib/server/ai', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/server/ai')>(),
  draft: (...args: unknown[]) => draft(...args),
  explain: (...args: unknown[]) => explain(...args),
}));
import { POST } from '../app/api/[...path]/route';
import { sameOrigin } from '../lib/server/http';

const controllerId = `0x${'81'.repeat(32)}`;
const eventId = '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';
function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const request = new Request(`http://localhost/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return POST(request, { params: Promise.resolve({ path: path.split('/') }) });
}
beforeEach(() => { consume.mockReset(); draft.mockReset(); explain.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('AI endpoints are throttled', () => {
  const ip = { 'x-real-ip': '203.0.113.9' };
  test('draft: 6 per minute per network, 60 per minute overall', async () => {
    draft.mockResolvedValue({ fields: {} });
    consume.mockResolvedValue(true);
    expect((await post('controller/breach/draft', { controllerId, narrative: 'Synthetic incident.' }, ip)).status).toBe(200);
    expect(consume.mock.calls).toEqual([['ai-draft:203.0.113.9', 6], ['ai-draft:all', 60]]);

    consume.mockReset().mockResolvedValueOnce(false);
    const perIp = await post('controller/breach/draft', { controllerId, narrative: 'Synthetic incident.' }, ip);
    expect(perIp.status).toBe(429);
    expect((await perIp.json()).error.code).toBe('RATE_LIMITED');
    // The global bucket is not charged for a request the per-network limit already refused.
    expect(consume).toHaveBeenCalledTimes(1);

    consume.mockReset().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await post('controller/breach/draft', { controllerId, narrative: 'Synthetic incident.' }, ip)).status).toBe(429);
    expect(draft).toHaveBeenCalledTimes(1);
  });

  test('explain: 20 per minute per network', async () => {
    explain.mockResolvedValue({ text: 'ok' });
    consume.mockResolvedValue(true);
    expect((await post('ai/explain', { eventId }, ip)).status).toBe(200);
    expect(consume.mock.calls[0]).toEqual(['ai-explain:203.0.113.9', 20]);
    consume.mockReset().mockResolvedValue(false);
    expect((await post('ai/explain', { eventId }, ip)).status).toBe(429);
    expect(explain).toHaveBeenCalledTimes(1);
  });

  test('invalid bodies are rejected before they spend quota', async () => {
    expect((await post('controller/breach/draft', { controllerId, narrative: '' })).status).toBe(400);
    expect(consume).not.toHaveBeenCalled();
  });
});

describe('state-changing requests check Origin', () => {
  const at = (url: string, headers: Record<string, string>) => new Request(url, { method: 'POST', headers });
  test('cross-site POST and DELETE are a 403 before any work', async () => {
    const response = await post('controller/breach/draft', { controllerId, narrative: 'Synthetic incident.' }, { origin: 'https://evil.example' });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: 'BAD_ORIGIN', message: 'Cross-site requests are not allowed.' } });
    const removal = await POST(new Request('http://localhost/api/citizen/session', { method: 'DELETE', headers: { origin: 'null' } }),
      { params: Promise.resolve({ path: ['citizen', 'session'] }) });
    expect(removal.status).toBe(403);
    expect(consume).not.toHaveBeenCalled();
    expect(draft).not.toHaveBeenCalled();
  });

  test('same-origin browsers, local dev and clients without Origin pass', async () => {
    draft.mockResolvedValue({ fields: {} });
    consume.mockResolvedValue(true);
    expect((await post('controller/breach/draft', { controllerId, narrative: 'Synthetic incident.' }, { origin: 'http://localhost' })).status).toBe(200);
    expect((await post('controller/breach/draft', { controllerId, narrative: 'Synthetic incident.' })).status).toBe(200);
    // Behind Caddy: the app sees http://127.0.0.1:3000 but the browser used https://saksiku.web.id.
    expect(sameOrigin(at('http://127.0.0.1:3000/api/x', { origin: 'https://saksiku.web.id', host: 'saksiku.web.id', 'x-forwarded-proto': 'https' }))).toBe(true);
    expect(sameOrigin(at('http://127.0.0.1:3000/api/x', { origin: 'https://saksiku.web.id', 'x-forwarded-host': 'saksiku.web.id', 'x-forwarded-proto': 'https' }))).toBe(true);
    expect(sameOrigin(at('http://localhost:3000/api/x', { origin: 'http://localhost:3000' }))).toBe(true);
    expect(sameOrigin(at('http://192.168.1.20:3000/api/x', { origin: 'http://192.168.1.20:3000', host: '192.168.1.20:3000' }))).toBe(true);
    // The scheme is part of the origin.
    expect(sameOrigin(at('http://127.0.0.1:3000/api/x', { origin: 'http://saksiku.web.id', host: 'saksiku.web.id', 'x-forwarded-proto': 'https' }))).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://saksiku.web.id');
    expect(sameOrigin(at('http://127.0.0.1:3000/api/x', { origin: 'https://saksiku.web.id' }))).toBe(true);
    expect(sameOrigin(at('http://127.0.0.1:3000/api/x', { origin: 'https://saksiku.web.id.evil.example' }))).toBe(false);
  });
});
