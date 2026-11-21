import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
// The presenter endpoints read through db().execute; a queue of canned results stands in for Postgres.
const execute = vi.fn();
vi.mock('../db/client', () => ({ db: () => ({ execute }) }));
import { evidenceHash } from '../lib/shared/commit';
import { encrypt } from '../lib/server/crypto';
import { toDemoReceipts } from '../lib/server/demo';
import { GET, POST } from '../app/api/[...path]/route';

const token = 'synthetic-demo-admin-token-for-tests';
const dataKey = '11'.repeat(32);
const ids = ['3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f', '7a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d', 'c0ffee00-1234-4abc-9def-001122334455'];
const controller = `0x${'81'.repeat(32)}`;
const tx = (n: string) => `0x${n.repeat(64)}`;
const KEYS = ['blockNumber', 'controllerName', 'createdAt', 'editable', 'eventType', 'id', 'logIndex', 'restorable', 'state', 'status', 'txHash'];

// The shape Postgres returns for to_jsonb(access_events row), with synthetic values only.
const snapshot = (id: string, eventType: number, createdAt: string, txChar: string) => ({
  id, controller_id: controller, subject_id: null, subject_pseudonym: tx('b'), purpose_text_enc: 'enc', purpose_salt_enc: 'iv.enc', enc_iv: 'iv',
  purpose_hash: tx('c'), legal_basis_key: tx('d'), event_type: eventType, evidence_enc: 'enc', evidence_iv: 'iv', evidence_hash: tx('e'),
  status: 'anchored', fail_reason: null, tx_hash: tx(txChar), log_index: 0, block_number: 12181700, block_time: 1763600000, created_at: createdAt,
});

function call(handler: typeof GET, method: string, path: string, options: { body?: unknown; demoToken?: string } = {}) {
  const headers: Record<string, string> = {};
  if (options.demoToken !== undefined) headers['x-demo-token'] = options.demoToken;
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const request = new Request(`http://localhost/api/${path}`, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  return handler(request, { params: Promise.resolve({ path: path.split('/') }) });
}

beforeEach(() => { execute.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('presenter endpoints require the demo token', () => {
  test.each([
    ['no token configured', undefined, token],
    ['no header', token, undefined],
    ['wrong token', token, 'synthetic-demo-admin-token-for-tesTS'],
    ['different length', token, 'short'],
  ])('%s → 403 before any database access', async (_, configured, provided) => {
    vi.stubEnv('DEMO_ADMIN_TOKEN', configured ?? '');
    for (const response of [
      await call(GET, 'GET', 'demo/receipts', { demoToken: provided }),
      await call(POST, 'POST', 'demo/tamper', { demoToken: provided, body: { action: 'delete', eventId: ids[0] } }),
      await call(GET, 'GET', 'status', { demoToken: provided }),
    ]) {
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: { code: 'FORBIDDEN', message: 'A valid demo token is required.' } });
    }
    expect(execute).not.toHaveBeenCalled();
  });

  test('tamper validates its body after the token check', async () => {
    vi.stubEnv('DEMO_ADMIN_TOKEN', token);
    const response = await call(POST, 'POST', 'demo/tamper', { demoToken: token, body: { action: 'drop', eventId: ids[0] } });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_INPUT');
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('GET /api/demo/receipts', () => {
  test('returns display fields only, with live, edited and deleted rows', async () => {
    vi.stubEnv('DEMO_ADMIN_TOKEN', token);
    vi.stubEnv('DATA_KEY', dataKey);
    const intact = snapshot(ids[0], 3, '2026-11-21T03:00:00.123456+00:00', 'a');
    const edited = snapshot(ids[1], 0, '2026-11-21T02:00:00.5+00:00', 'f');
    const deleted = encrypt(JSON.stringify(snapshot(ids[2], 3, '2026-11-21T04:00:00+00:00', '9')));
    execute
      .mockResolvedValueOnce([{ snapshot: intact, controller_name: 'Demo One' }, { snapshot: edited, controller_name: 'Demo One' }])
      .mockResolvedValueOnce([{ snapshot: `${deleted.iv}.${deleted.ciphertext}` }])
      .mockResolvedValueOnce([{ id: controller, name: 'Demo One' }])
      .mockResolvedValueOnce([{ target_id: ids[1], after_hash: evidenceHash(edited) }, { target_id: ids[0], after_hash: evidenceHash(null) }]);

    const response = await call(GET, 'GET', 'demo/receipts', { demoToken: token });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const { rows } = await response.json();
    expect(rows.map((row: object) => Object.keys(row).sort())).toEqual([KEYS, KEYS, KEYS]);
    expect(rows).toEqual([
      { id: ids[2], controllerName: 'Demo One', eventType: 3, createdAt: '2026-11-21T04:00:00.000Z', txHash: tx('9'), logIndex: 0,
        blockNumber: 12181700, status: 'anchored', state: 'deleted', restorable: true, editable: false },
      { id: ids[0], controllerName: 'Demo One', eventType: 3, createdAt: '2026-11-21T03:00:00.123Z', txHash: tx('a'), logIndex: 0,
        blockNumber: 12181700, status: 'anchored', state: 'intact', restorable: false, editable: true },
      { id: ids[1], controllerName: 'Demo One', eventType: 0, createdAt: '2026-11-21T02:00:00.500Z', txHash: tx('f'), logIndex: 0,
        blockNumber: 12181700, status: 'anchored', state: 'edited', restorable: true, editable: false },
    ]);
    // No encrypted columns, pseudonyms or hashes beyond the public transaction hash leave the server.
    expect(JSON.stringify(rows)).not.toMatch(/enc|pseudonym|subject|purpose|evidence/);
  });

  test('skips the tamper-log lookup when no live rows exist', async () => {
    vi.stubEnv('DEMO_ADMIN_TOKEN', token);
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const response = await call(GET, 'GET', 'demo/receipts', { demoToken: token });
    expect(await response.json()).toEqual({ rows: [] });
    expect(execute).toHaveBeenCalledTimes(3);
  });
});

describe('toDemoReceipts', () => {
  const names = new Map([[controller, 'Demo Two']]);
  test('a row restored to its recorded state is intact again, and Edit needs SHARE_THIRD_PARTY', () => {
    const original = snapshot(ids[0], 3, '2026-11-21T03:00:00+00:00', 'a');
    const editedHash = evidenceHash({ ...original, event_type: 0 });
    const [row] = toDemoReceipts([{ snapshot: original, controllerName: 'Demo Two' }], [], [{ targetId: ids[0], afterHash: editedHash }], names);
    expect(row).toMatchObject({ state: 'intact', restorable: false, editable: true });
    const [read] = toDemoReceipts([{ snapshot: snapshot(ids[1], 0, '2026-11-21T03:00:00+00:00', 'b'), controllerName: 'Demo Two' }], [], [], names);
    expect(read).toMatchObject({ state: 'intact', editable: false });
  });

  test('deleted rows fall back to a neutral name and reject malformed snapshots', () => {
    const [row] = toDemoReceipts([], [{ snapshot: { ...snapshot(ids[2], 1, '2026-11-21T03:00:00+00:00', 'c'), controller_id: tx('0') } }], [], names);
    expect(row).toMatchObject({ controllerName: 'Unknown controller', state: 'deleted', restorable: true, editable: false });
    expect(() => toDemoReceipts([], [{ snapshot: { id: 'nope' } }], [], names)).toThrow();
  });
});
