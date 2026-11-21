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
