import { afterEach, describe, expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
// No session cookie: the route answers before it would touch the database.
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { reviewMessage } from '../lib/shared/report-message';
import { pseudonym } from '../lib/server/crypto';
import { aggregateControllers, registryChanges, type RegistryChange, type Scan } from '../lib/server/controller-register';
import { chainEventId, createReport, reportInput, reviewInput, reviewReport, toRegulatorReport, type NewReport, type ReportStore } from '../lib/server/reports';
import type { AccessRow } from '../lib/server/access';
import { rememberedChain } from '../lib/client/seen-receipts';
import type { ReceiptOpening } from '../lib/shared/types';
import { GET, POST } from '../app/api/[...path]/route';

// Synthetic values only: fictional ids, throwaway keys generated for this test file.
const me = '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';
const someoneElse = '7a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d';
const eventId = 'c0ffee00-1234-4abc-9def-001122334455';
const controllerId = `0x${'81'.repeat(32)}` as Hex;
const txHash = `0x${'ab'.repeat(32)}` as Hex;
const salt = `0x${'5a'.repeat(32)}` as Hex;
const purpose = 'Shared contact details with a collection partner';
const subjectPseudonym = `0x${'b7'.repeat(32)}`;

const row = (over: Partial<AccessRow> = {}): AccessRow => ({
  id: eventId, controllerId, subjectId: me, subjectPseudonym, purposeTextEnc: 'enc:' + purpose, purposeSaltEnc: 'iv.enc', encIv: 'iv',
  purposeHash: `0x${'c1'.repeat(32)}`, legalBasisKey: `0x${'d1'.repeat(32)}`, eventType: 3, evidenceEnc: 'enc', evidenceIv: 'iv',
  evidenceHash: `0x${'e1'.repeat(32)}`, status: 'anchored', failReason: null, txHash, logIndex: 4, blockNumber: 12_181_700,
  blockTime: 1_795_300_000, createdAt: new Date('2026-11-21T12:29:00Z'), ...over,
});

function store(over: Partial<ReportStore> = {}) {
  const inserted: NewReport[] = [];
  const s: ReportStore = {
    limit: async () => true,
    eventById: async () => ({ row: row(), controllerName: 'Dinas Layanan Kota Contoh (fiktif)' }),
    eventByLog: async () => undefined,
    subjectSalt: async () => salt,
    chainLog: async () => null,
    verify: async () => 'ALTERED',
    insert: async (values) => { inserted.push(values); return { id: '11111111-2222-4333-8444-555555555555', createdAt: new Date('2026-11-22T01:00:00Z') }; },
    ...over,
  };
  return { s, inserted };
}
const body = (over: Record<string, unknown> = {}) => reportInput.parse({ eventId, reason: 'altered', ...over });
const status = (promise: Promise<unknown>) => promise.then(() => 200, (error: { status?: number }) => error.status);

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('citizen report', () => {
  test('stores the server verdict and a copy of the access row, never the browser verdict', async () => {
    const { s, inserted } = store();
    const result = await createReport(me, body({ note: '  I never use this agency  ' }), '10.0.0.1', s);
    expect(result).toMatchObject({ status: 'open', serverVerdict: 'ALTERED', reason: 'altered' });
    expect(inserted).toEqual([{ eventId, subjectId: me, controllerId, eventType: 3, txHash, logIndex: 4, sealedAt: 1_795_300_000,
      reason: 'altered', note: 'I never use this agency', serverVerdict: 'ALTERED' }]);
  });

  test('only for an event that belongs to the session subject', async () => {
    const { s, inserted } = store({ eventById: async () => ({ row: row({ subjectId: someoneElse }), controllerName: 'X' }) });
    expect(await status(createReport(me, body(), '10.0.0.1', s))).toBe(404);
    const unlinked = store({ eventById: async () => ({ row: row({ subjectId: null }), controllerName: 'X' }) });
    expect(await status(createReport(me, body(), '10.0.0.1', unlinked.s))).toBe(404);
    expect(inserted).toHaveLength(0);
  });

  test('a second open report for the same event and reason is refused', async () => {
    const { s } = store({ insert: async () => undefined });
    expect(await status(createReport(me, body(), '10.0.0.1', s))).toBe(409);
  });

  test('is rate limited per session and per network', async () => {
    const keys: string[] = [];
    const { s, inserted } = store({ limit: async (key) => { keys.push(key); return !key.startsWith('report-ip:'); } });
    expect(await status(createReport(me, body(), '10.0.0.9', s))).toBe(429);
    expect(keys).toEqual([`report:${me}`, 'report-ip:10.0.0.9']);
    expect(inserted).toHaveLength(0);
  });

  test('rejects a note over 280 characters and unknown reasons', () => {
    expect(reportInput.safeParse({ eventId, reason: 'object', note: 'x'.repeat(281) }).success).toBe(false);
    expect(reportInput.safeParse({ eventId, reason: 'spam' }).success).toBe(false);
    expect(reportInput.parse({ eventId, reason: 'object', note: '   ' }).note).toBeNull();
  });

  describe('a receipt deleted from Saksi’s store', () => {
    const chain = { txHash, logIndex: 4 };
    test('is accepted as DELETED when the chain event carries this citizen’s pseudonym', async () => {
      vi.stubEnv('SUBJECT_KEY', '22'.repeat(32));
      const mine = pseudonym(controllerId, me, salt);
      const { s, inserted } = store({ eventById: async () => undefined,
        chainLog: async () => ({ controllerId, subjectPseudonym: mine, eventType: 3, timestamp: 1_795_300_000n }) });
      const result = await createReport(me, body({ chain }), '10.0.0.1', s);
      expect(result.serverVerdict).toBe('DELETED');
      expect(inserted[0]).toMatchObject({ eventId: chainEventId(txHash, 4), controllerId, txHash, logIndex: 4, sealedAt: 1_795_300_000, serverVerdict: 'DELETED' });
    });

    test('stores an event id derived from the chain position, never the one the browser sent', async () => {
      vi.stubEnv('SUBJECT_KEY', '22'.repeat(32));
      const mine = pseudonym(controllerId, me, salt);
      const { s, inserted } = store({ eventById: async () => undefined,
        chainLog: async () => ({ controllerId, subjectPseudonym: mine, eventType: 3, timestamp: 1_795_300_000n }) });
      await createReport(me, body({ chain }), '10.0.0.1', s);
      await createReport(me, body({ chain, eventId: someoneElse }), '10.0.0.1', s);
      expect(inserted.map((r) => r.eventId)).toEqual([chainEventId(txHash, 4), chainEventId(txHash, 4)]);
      expect(inserted[0].eventId).not.toBe(eventId);
    });

    test('the derived event id is a stable UUID per chain position', () => {
      const id = chainEventId(txHash, 4);
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(reportInput.shape.eventId.safeParse(id).success).toBe(true);
      expect(chainEventId(txHash.toUpperCase().replace('0X', '0x') as Hex, 4)).toBe(id);
      expect(chainEventId(txHash, 5)).not.toBe(id);
      expect(chainEventId(`0x${'cd'.repeat(32)}`, 4)).not.toBe(id);
    });

    test('is refused when the chain event belongs to someone else', async () => {
      vi.stubEnv('SUBJECT_KEY', '22'.repeat(32));
      const theirs = pseudonym(controllerId, someoneElse, salt);
      const { s, inserted } = store({ eventById: async () => undefined,
        chainLog: async () => ({ controllerId, subjectPseudonym: theirs, eventType: 3, timestamp: 1n }) });
      expect(await status(createReport(me, body({ chain }), '10.0.0.1', s))).toBe(404);
      expect(await status(createReport(me, body(), '10.0.0.1', s))).toBe(404);
      expect(inserted).toHaveLength(0);
    });
  });
});

describe('regulator list', () => {
  test('carries no purpose text and no pseudonym, and masks the citizen code', () => {
    const view = toRegulatorReport({
      report: { id: 'r1', eventId, subjectId: me, controllerId, eventType: 3, txHash, logIndex: 4, sealedAt: 1_795_300_000, reason: 'not_me',
        note: null, serverVerdict: 'MATCH', status: 'open', createdAt: new Date('2026-11-22T01:00:00Z'), reviewedAt: null, reviewedBy: null },
      controllerName: 'RS Sehat Contoh (fiktif)', code: 'K7M2QD',
    });
    expect(view.citizenMasked).toBe('K7••••');
    expect(view.eventType).toBe('SHARE_THIRD_PARTY');
    const text = JSON.stringify(view);
    expect(text).not.toContain('K7M2QD');
    expect(text).not.toContain(purpose);
    expect(text).not.toContain(subjectPseudonym.slice(2, 20));
    expect(text).not.toContain(me);
    expect(Object.keys(view).sort()).toEqual(['citizenMasked', 'controllerId', 'controllerName', 'createdAt', 'eventType', 'id', 'logIndex', 'note',
      'reason', 'reviewedAt', 'reviewedBy', 'sealedAt', 'serverVerdict', 'status', 'txHash']);
  });
});

describe('review signature', () => {
  const admin = privateKeyToAccount(`0x${'4c'.repeat(32)}`);
  const stranger = privateKeyToAccount(`0x${'9e'.repeat(32)}`);
  const id = '11111111-2222-4333-8444-555555555555';
  const now = Date.parse('2026-11-22T02:00:00.000Z');
  const marks: [string, string][] = [];
  const deps = {
    admin: async () => admin.address.toLowerCase() as Hex,
    mark: async (reportId: string, reviewer: Hex, at: Date) => { marks.push([reportId, reviewer]); return { status: 'reviewed' as const, reviewedAt: at, reviewedBy: reviewer }; },
  };
  const signed = async (signer: typeof admin, signedAt: string, message = reviewMessage(id, signedAt)) =>
    reviewInput.parse({ id, signedAt, signature: await signer.signMessage({ message }) });

  test('the registry admin signing the exact message marks the report reviewed', async () => {
    marks.length = 0;
    const result = await reviewReport(await signed(admin, '2026-11-22T01:58:30.000Z'), now, deps);
    expect(result).toMatchObject({ id, status: 'reviewed', reviewedBy: admin.address.toLowerCase() });
    expect(marks).toEqual([[id, admin.address.toLowerCase()]]);
  });

  test('a different wallet is rejected', async () => {
    marks.length = 0;
    expect(await status(reviewReport(await signed(stranger, '2026-11-22T01:59:00.000Z'), now, deps))).toBe(403);
    expect(marks).toHaveLength(0);
  });

  test('a signature for another report is rejected', async () => {
    const other = await signed(admin, '2026-11-22T01:59:00.000Z', reviewMessage('99999999-2222-4333-8444-555555555555', '2026-11-22T01:59:00.000Z'));
    expect(await status(reviewReport(other, now, deps))).toBe(403);
  });

  test('a signature older than 5 minutes, or from the future, is stale', async () => {
    marks.length = 0;
    expect(await status(reviewReport(await signed(admin, '2026-11-22T01:54:59.000Z'), now, deps))).toBe(401);
    expect(await status(reviewReport(await signed(admin, '2026-11-22T02:03:00.000Z'), now, deps))).toBe(401);
    expect(marks).toHaveLength(0);
  });

  test('the message is the documented EIP-191 text', () => {
    expect(reviewMessage(id, '2026-11-22T01:58:30.000Z')).toBe(`Saksi: mark report ${id} reviewed at 2026-11-22T01:58:30.000Z`);
  });
});

describe('controller register', () => {
  const a = `0x${'a1'.repeat(32)}` as Hex, b = `0x${'b2'.repeat(32)}` as Hex;
  const eoa = (n: string) => `0x${n.repeat(40)}` as Hex;
  const tx = (n: string) => `0x${n.repeat(64)}` as Hex;
  const changes: RegistryChange[] = [
    { kind: 'registered', controllerId: b, eoa: eoa('2'), name: 'RS Sehat Contoh (fiktif)', blockNumber: 12_181_670n, logIndex: 1, txHash: tx('2') },
    { kind: 'registered', controllerId: a, eoa: eoa('1'), name: 'Dinas Layanan Kota Contoh (fiktif)', blockNumber: 12_181_670n, logIndex: 0, txHash: tx('1') },
    { kind: 'revoked', controllerId: b, eoa: eoa('2'), blockNumber: 12_181_900n, logIndex: 0, txHash: tx('3') },
  ];

  test('joins chain registrations with sealed receipts, Watch, breaches and open reports', () => {
    const rows = aggregateControllers({
      changes, blockTimes: new Map([[12_181_670n, 1_795_200_000]]),
      activity: [{ controllerId: a, n: 7, last: new Date('2026-11-21T12:00:00Z') }, { controllerId: `0x${'ff'.repeat(32)}`, n: 99, last: null }],
      breaches: [{ controllerId: a, mode: 'on_time', n: 1, last: new Date('2026-11-21T13:00:00Z') }, { controllerId: a, mode: 'late', n: 2, last: null }],
      openReports: [{ controllerId: a, n: 3 }],
      watchRows: [
        { status: 'ALTERED', eventId: 'e1', controllerName: 'Dinas Layanan Kota Contoh (fiktif)' },
        { status: 'DELETED', eventId: null, controllerName: 'Dinas Layanan Kota Contoh (fiktif)' },
        { status: 'DELETED', eventId: null, controllerName: b },
        { status: 'MATCH', eventId: 'e2', controllerName: 'Dinas Layanan Kota Contoh (fiktif)' },
      ],
      eventControllers: new Map([['e1', a]]),
    });
    expect(rows.map((r) => [r.name, r.status])).toEqual([['Dinas Layanan Kota Contoh (fiktif)', 'active'], ['RS Sehat Contoh (fiktif)', 'revoked']]);
    expect(rows[0]).toMatchObject({ sealed: 7, altered: 1, deleted: 1, breachesOnTime: 1, breachesLate: 2, openReports: 3,
      registeredAt: 1_795_200_000, registrationTx: tx('1'), revocationTx: null, lastActivity: '2026-11-21T13:00:00.000Z' });
    expect(rows[1]).toMatchObject({ sealed: 0, altered: 0, deleted: 1, openReports: 0, revocationTx: tx('3'), registrationTx: tx('2') });
  });

  test('unknown Watch or report data stays unknown instead of zero', () => {
    const [row] = aggregateControllers({ changes: changes.slice(1, 2), blockTimes: new Map(), activity: [], breaches: [], openReports: null, watchRows: null, eventControllers: new Map() });
    expect(row).toMatchObject({ altered: null, deleted: null, openReports: null, registeredAt: null, lastActivity: null });
  });

  test('a controller registered again after a revocation is active with the newer registration', () => {
    const again: RegistryChange = { kind: 'registered', controllerId: b, eoa: eoa('4'), name: 'RS Sehat Contoh (fiktif)', blockNumber: 12_182_000n, logIndex: 2, txHash: tx('4') };
    const rows = aggregateControllers({ changes: [...changes, again], blockTimes: new Map(), activity: [], breaches: [], openReports: [], watchRows: [], eventControllers: new Map() });
    expect(rows.find((r) => r.id === b)).toMatchObject({ status: 'active', eoa: eoa('4'), registrationTx: tx('4'), revocationTx: null });
  });
});

describe('controller register scan', () => {
  const scan = (head: bigint, at: number): Scan => ({ changes: [], head, at });
  // registryChanges keeps module state, so these steps run in order inside one test.
  test('shares one scan, falls back to the last good scan on error, and throws only with nothing cached', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = new Error('rpc down');
    await expect(registryChanges(async () => { throw boom; })).rejects.toBe(boom);
    expect(log).toHaveBeenCalledTimes(1);

    let calls = 0;
    const first = scan(100n, Date.now());
    const slow = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return first; };
    const [a, b] = await Promise.all([registryChanges(slow), registryChanges(slow)]);
    expect(calls).toBe(1);
    expect(a).toBe(first);
    expect(b).toBe(first);

    // Past the 30 s cache window a failing scan returns the previous scan with its real time.
    vi.spyOn(Date, 'now').mockReturnValue(first.at + 31_000);
    const stale = await registryChanges(async () => { throw boom; });
    expect(stale).toBe(first);
    expect(stale.at).toBe(first.at);
    expect(log).toHaveBeenCalledTimes(2);

    const second = scan(200n, first.at + 31_000);
    expect(await registryChanges(async () => second)).toBe(second);
  });
});

describe('deleted receipt kept on this phone', () => {
  const opening = (over: Partial<ReceiptOpening> = {}) => ({
    eventId, controllerId, controllerName: 'Dinas Layanan Kota Contoh (fiktif)', subjectPseudonym, purposeText: purpose, purposeSalt: `0x${'01'.repeat(32)}`,
    legalBasisKey: `0x${'d1'.repeat(32)}`, eventType: 3, evidence: {},
    txHash, logIndex: 4, status: 'anchored', createdAt: '2026-11-21T12:29:00.000Z', ...over,
  }) as ReceiptOpening;
  const remember = (o: ReceiptOpening) => {
    const items = new Map([['saksi:seen-receipts:v1', JSON.stringify({ code: 'K7M2QD', seen: { [o.eventId]: { opening: o, lastSeenAt: 1 } } })]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => items.get(k) ?? null, setItem: () => {}, removeItem: () => {} });
  };

  test('gives the chain position to report it from', () => {
    remember(opening());
    expect(rememberedChain(eventId)).toEqual({ txHash, logIndex: 4 });
    expect(rememberedChain(someoneElse)).toBeNull();
    remember(opening({ txHash: null, logIndex: null }));
    expect(rememberedChain(eventId)).toBeNull();
  });
});

describe('routes', () => {
  const call = (handler: typeof GET, method: string, path: string, body?: unknown) => handler(
    new Request(`http://localhost/api/${path}`, body === undefined ? { method } : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ path: path.split('/') }) });

  test('GET citizen/session answers 200 signedIn:false without a session, never 401', async () => {
    const response = await call(GET, 'GET', 'citizen/session');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ signedIn: false });
  });

  test('POST citizen/report needs a citizen session', async () => {
    const response = await call(POST, 'POST', 'citizen/report', { eventId, reason: 'not_me' });
    expect(response.status).toBe(401);
  });

  test('POST regulator/reports/review rejects a malformed signature before any chain or database call', async () => {
    const response = await call(POST, 'POST', 'regulator/reports/review', { id: eventId, signedAt: '2026-11-22T01:00:00.000Z', signature: '0x1234' });
    expect(response.status).toBe(400);
  });
});
