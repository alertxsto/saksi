import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
// Submit reads the draft through db().select() and writes it with db().update(); both are stubbed here.
const draftRows = vi.fn();
const update = vi.fn();
vi.mock('../db/client', () => ({
  db: () => ({
    select: () => ({ from: () => ({ where: async () => draftRows() }) }),
    update: (...args: unknown[]) => { update(...args); return { set: () => ({ where: () => ({ returning: async () => [{ id: 'updated' }] }) }) }; },
  }),
}));
const getTransactionRobust = vi.fn();
const readContract = vi.fn();
vi.mock('../lib/shared/chain', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/shared/chain')>(),
  publicClient: { readContract: (...args: unknown[]) => readContract(...args) },
  getTransactionRobust: (...args: unknown[]) => getTransactionRobust(...args),
}));
import { encodeFunctionData, type Hex } from 'viem';
import { accessAbi, breachAbi } from '../lib/shared/abi';
import { callMatchesDraft, STALE_SUBMISSION_MS, unknownTransaction, visibleTransaction } from '../lib/server/chain';
import { submitAccess } from '../lib/server/access';
import { submitToken } from '../lib/server/submit-token';
import { submission } from '../lib/client/api';

const b32 = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;
const journal: Hex = `0x${'2'.repeat(40)}`;
const breach: Hex = `0x${'3'.repeat(40)}`;
const sender: Hex = `0x${'4'.repeat(40)}`;
const id = '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';
const txHash = b32(0xabc);
const accessArgs = [b32(1), b32(2), b32(3), b32(4), 3, b32(5)] as const;
const logAccess = (args: readonly [Hex, Hex, Hex, Hex, number, Hex] = accessArgs) =>
  encodeFunctionData({ abi: accessAbi, functionName: 'logAccess', args });
const draft = { id, controllerId: accessArgs[0], subjectPseudonym: accessArgs[1], purposeHash: accessArgs[2], legalBasisKey: accessArgs[3],
  eventType: accessArgs[4], evidenceHash: accessArgs[5], status: 'pending', txHash: null };

beforeEach(() => {
  draftRows.mockReset(); update.mockReset(); getTransactionRobust.mockReset(); readContract.mockReset();
  vi.stubEnv('SESSION_SECRET', 'synthetic-session-secret-for-tests-only-0123456789');
  vi.stubEnv('NEXT_PUBLIC_JOURNAL_ADDRESS', journal);
  vi.stubEnv('NEXT_PUBLIC_BREACH_ADDRESS', breach);
  vi.stubEnv('NEXT_PUBLIC_REGISTRY_ADDRESS', `0x${'1'.repeat(40)}`);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('submitted transaction must match the prepared draft', () => {
  test('access: journal address, logAccess and every draft argument', () => {
    expect(callMatchesDraft({ to: journal, input: logAccess() }, journal, accessAbi, ['logAccess'], accessArgs)).toBe(true);
    // Addresses and hashes compare case-insensitively.
    expect(callMatchesDraft({ to: journal.toUpperCase().replace('0X', '0x') as Hex, input: logAccess() }, journal, accessAbi, ['logAccess'], accessArgs)).toBe(true);
    expect(callMatchesDraft({ to: breach, input: logAccess() }, journal, accessAbi, ['logAccess'], accessArgs)).toBe(false);
    expect(callMatchesDraft({ to: null, input: logAccess() }, journal, accessAbi, ['logAccess'], accessArgs)).toBe(false);
    expect(callMatchesDraft({ to: journal, input: logAccess([b32(1), b32(2), b32(3), b32(4), 0, b32(5)]) }, journal, accessAbi, ['logAccess'], accessArgs)).toBe(false);
    expect(callMatchesDraft({ to: journal, input: logAccess([b32(1), b32(9), b32(3), b32(4), 3, b32(5)]) }, journal, accessAbi, ['logAccess'], accessArgs)).toBe(false);
    expect(callMatchesDraft({ to: journal, input: '0x' }, journal, accessAbi, ['logAccess'], accessArgs)).toBe(false);
    expect(callMatchesDraft({ to: journal, input: '0xdeadbeef' }, journal, accessAbi, ['logAccess'], accessArgs)).toBe(false);
  });

  test('breach: anchor or anchorLate with the draft arguments, detectedAt as uint64', () => {
    const args = [b32(1), b32(7), b32(8), 1_763_600_000n] as const;
    for (const functionName of ['anchor', 'anchorLate'] as const) {
      const input = encodeFunctionData({ abi: breachAbi, functionName, args });
      expect(callMatchesDraft({ to: breach, input }, breach, breachAbi, ['anchor', 'anchorLate'], args)).toBe(true);
      expect(callMatchesDraft({ to: breach, input }, breach, breachAbi, ['anchor', 'anchorLate'], [b32(1), b32(7), b32(8), 1_763_600_001n])).toBe(false);
    }
  });
});

describe('waiting for a broadcast transaction', () => {
  const tx = { to: journal, from: sender, input: logAccess() };
  test('polls until an RPC shows the transaction', async () => {
    const find = vi.fn().mockResolvedValueOnce({ transaction: null }).mockResolvedValueOnce({ transaction: null }).mockResolvedValue({ transaction: tx });
    const wait = vi.fn(async () => {});
    await expect(visibleTransaction(txHash, { find, wait })).resolves.toBe(tx);
    expect(find).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledWith(1_000);
  });

  test('gives up after the attempts or the time window', async () => {
    const find = vi.fn(async () => ({ transaction: null }));
    await expect(visibleTransaction(txHash, { find, wait: async () => {}, attempts: 3 })).resolves.toBeNull();
    expect(find).toHaveBeenCalledTimes(3);
    find.mockClear();
    await expect(visibleTransaction(txHash, { find, wait: async () => {}, windowMs: 0 })).resolves.toBeNull();
    expect(find).toHaveBeenCalledTimes(1);
  });
});

describe('submitAccess', () => {
  const body = () => ({ id, txHash, submitToken: submitToken('access', id) });

  test('rejects a made-up hash with a retryable TX_NOT_VISIBLE and leaves the draft pending', async () => {
    vi.useFakeTimers();
    draftRows.mockResolvedValue([draft]);
    getTransactionRobust.mockResolvedValue({ transaction: null, missing: true });
    const result = submitAccess(body()).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toMatchObject({ status: 409, code: 'TX_NOT_VISIBLE' });
    expect(getTransactionRobust.mock.calls.length).toBeGreaterThan(1);
    expect(update).not.toHaveBeenCalled();
  });

  test('rejects a real transaction that does not carry this draft', async () => {
    draftRows.mockResolvedValue([draft]);
    getTransactionRobust.mockResolvedValue({ transaction: { to: journal, from: sender, input: logAccess([b32(1), b32(2), b32(3), b32(4), 0, b32(5)]) } });
    await expect(submitAccess(body())).rejects.toMatchObject({ status: 400, code: 'TX_MISMATCH' });
    expect(update).not.toHaveBeenCalled();
  });

  test('rejects a sender the registry does not authorize', async () => {
    draftRows.mockResolvedValue([draft]);
    getTransactionRobust.mockResolvedValue({ transaction: { to: journal, from: sender, input: logAccess() } });
    readContract.mockResolvedValue(false);
    await expect(submitAccess(body())).rejects.toMatchObject({ status: 403, code: 'TX_NOT_AUTHORIZED' });
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'isAuthorized', args: [accessArgs[0], sender] }));
    expect(update).not.toHaveBeenCalled();
  });

  test('accepts the honest transaction, even when the registry read fails', async () => {
    draftRows.mockResolvedValue([draft]);
    getTransactionRobust.mockResolvedValue({ transaction: { to: journal, from: sender, input: logAccess() } });
    readContract.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('rpc down'));
    await expect(submitAccess(body())).resolves.toEqual({ status: 'submitted' });
    await expect(submitAccess(body())).resolves.toEqual({ status: 'submitted' });
    expect(update).toHaveBeenCalledTimes(2);
  });

  test('a repeated submit of the stored hash does not hit the chain again', async () => {
    draftRows.mockResolvedValue([{ ...draft, status: 'submitted', txHash }]);
    await expect(submitAccess(body())).resolves.toEqual({ status: 'submitted' });
    expect(getTransactionRobust).not.toHaveBeenCalled();
  });
});

describe('stale submitted rows', () => {
  const old = new Date(Date.now() - STALE_SUBMISSION_MS - 1_000);
  test('fail only when old and a node says the transaction does not exist', async () => {
    const find = vi.fn();
    await expect(unknownTransaction(txHash, new Date(), { find })).resolves.toBe(false);
    expect(find).not.toHaveBeenCalled();
    find.mockResolvedValueOnce({ transaction: null, missing: true });
    await expect(unknownTransaction(txHash, old, { find })).resolves.toBe(true);
    // Every RPC failing (missing stays false) must not fail an honest receipt.
    find.mockResolvedValueOnce({ transaction: null, missing: false });
    await expect(unknownTransaction(txHash, old, { find })).resolves.toBe(false);
    // Still in the mempool: keep waiting.
    find.mockResolvedValueOnce({ transaction: { to: journal }, missing: false });
    await expect(unknownTransaction(txHash, old, { find })).resolves.toBe(false);
  });
});

describe('client submit retries while the transaction propagates', () => {
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const notVisible = () => reply(409, { error: { code: 'TX_NOT_VISIBLE', message: 'Sepolia does not show this transaction yet. Saksi retries automatically.' } });
  test('retries TX_NOT_VISIBLE and then succeeds', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(notVisible()).mockResolvedValueOnce(notVisible()).mockResolvedValueOnce(reply(200, { status: 'submitted' }));
    vi.stubGlobal('fetch', fetch);
    const wait = vi.fn(async () => {});
    await expect(submission('access', { id }, { wait })).resolves.toBeInstanceOf(Response);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  test('keeps retrying on its own until the deadline, with backoff', async () => {
    let clock = 0
    const waits: number[] = []
    vi.stubGlobal('fetch', vi.fn(async () => notVisible()));
    await expect(submission('access', { id }, { now: () => clock, wait: async (ms) => { waits.push(ms); clock += ms }, timeoutMs: 30_000 }))
      .rejects.toMatchObject({ apiCode: 'TX_NOT_VISIBLE' });
    expect(waits[0]).toBe(2_000);
    expect(Math.max(...waits)).toBe(5_000);
    expect(waits.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(30_000);
  });

  test('stops after the attempts, and never retries other errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => notVisible()));
    await expect(submission('access', { id }, { wait: async () => {}, attempts: 3 })).rejects.toMatchObject({ apiCode: 'TX_NOT_VISIBLE', message: expect.stringContaining('checks it again') });
    expect(fetch).toHaveBeenCalledTimes(3);
    const mismatch = vi.fn(async () => reply(400, { error: { code: 'TX_MISMATCH', message: 'The transaction does not match this draft.' } }));
    vi.stubGlobal('fetch', mismatch);
    await expect(submission('breach', { id }, { wait: async () => {} })).rejects.toMatchObject({ apiCode: 'TX_MISMATCH' });
    expect(mismatch).toHaveBeenCalledTimes(1);
  });
});
