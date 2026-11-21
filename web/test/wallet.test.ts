import { ContractFunctionRevertedError, encodeErrorResult, type Hash } from 'viem';
import { describe, expect, it } from 'vitest';
import { createTransactionFlow, type TransactionIO } from '../lib/client/transactions';

const txHash: Hash = `0x${'ab'.repeat(32)}`;
const prepared = { id: 'preparation-1', args: ['commitment'] };
type IO = TransactionIO<string, typeof prepared>;

function transactionIO(overrides: Partial<IO> = {}): IO {
  return {
    prepare: async () => prepared,
    send: async () => txHash,
    submit: async () => {},
    wait: async () => 'success',
    confirm: async () => ({ status: 'anchored' }),
    ...overrides,
  };
}

function transaction() {
  return createTransactionFlow<string, typeof prepared>(() => {});
}

const expiredAbi = [{
  type: 'error', name: 'ClaimedWindowExpired', inputs: [
    { name: 'detectedAt', type: 'uint64' },
    { name: 'deadline', type: 'uint64' },
  ],
}] as const;

function windowExpired() {
  return new ContractFunctionRevertedError({
    abi: expiredAbi,
    data: encodeErrorResult({ abi: expiredAbi, errorName: 'ClaimedWindowExpired', args: [1n, 259201n] }),
    functionName: 'anchor',
  });
}

describe('wallet transaction flow', () => {
  it('submits the hash before starting the receipt wait and coalesces double clicks', async () => {
    const calls: string[] = [];
    const io = transactionIO({
      prepare: async (form) => { calls.push(`prepare:${form}`); return prepared; },
      send: async () => { calls.push('send'); return txHash; },
      submit: async (id, hash) => {
        calls.push(`submit:${id}:${hash}`);
        await Promise.resolve();
        calls.push('submit complete');
      },
      wait: async (hash) => { calls.push(`wait:${hash}`); return 'success'; },
      confirm: async (id) => { calls.push(`confirm:${id}`); return { status: 'anchored' }; },
    });
    const flow = transaction();
    const first = flow.start('first', io);
    const second = flow.start('second', io);
    expect(second).toBe(first);
    await expect(first).resolves.toEqual({ step: 'anchored', id: 'preparation-1', txHash });
    expect(calls).toEqual([
      'prepare:first', 'send', `submit:preparation-1:${txHash}`, 'submit complete',
      `wait:${txHash}`, 'confirm:preparation-1',
    ]);
  });

  it('re-confirms the same preparation after a receipt timeout without a new wallet write', async () => {
    const sends: Hash[] = [];
    const confirms: string[] = [];
    const flow = transaction();
    const io = transactionIO({
      send: async () => { sends.push(txHash); return txHash; },
      wait: async () => { throw Object.assign(new Error(), { name: 'WaitForTransactionReceiptTimeoutError' }); },
      confirm: async (id) => {
        confirms.push(id);
        return confirms.length === 1 ? { status: 'failed', reason: 'Receipt not found.' } : { status: 'anchored' };
      },
    });
    await expect(flow.start('form', io)).resolves.toMatchObject({
      step: 'failed', id: 'preparation-1', txHash, canReconfirm: true, error: { code: 'timeout' },
    });
    expect(flow.reset()).toBe(false);
    await flow.start('form', io);
    expect(confirms).toEqual([]);
    await expect(flow.reconfirm()).resolves.toMatchObject({ step: 'failed', txHash, error: { code: 'unconfirmed' } });
    expect(flow.reset()).toBe(false);
    await flow.start('form', io);
    await expect(flow.reconfirm()).resolves.toEqual({ step: 'anchored', id: 'preparation-1', txHash });
    expect(confirms).toEqual(['preparation-1', 'preparation-1']);
    expect(sends).toEqual([txHash]);
  });

  it('recovers a failed submit using the existing hash before calling confirm', async () => {
    const submitted: string[] = [];
    const flow = transaction();
    const io = transactionIO({
      submit: async (id, hash) => {
        submitted.push(`${id}:${hash}`);
        if (submitted.length === 1) throw new Error('offline');
      },
      wait: async () => { throw new Error('re-confirm must not wait again'); },
    });
    await expect(flow.start('form', io)).resolves.toMatchObject({ step: 'failed', txHash });
    await expect(flow.reconfirm()).resolves.toMatchObject({ step: 'anchored', txHash });
    expect(submitted).toEqual([`preparation-1:${txHash}`, `preparation-1:${txHash}`]);
  });

  it('asks for explicit late consent before signing the unchanged preparation', async () => {
    const sends: [typeof prepared, string][] = [];
    let prepareCount = 0;
    const flow = transaction();
    const io = transactionIO({
      prepare: async () => { prepareCount++; return prepared; },
      simulate: async (_, mode) => { if (mode === 'on_time') throw windowExpired(); },
      send: async (commitment, mode) => { sends.push([commitment, mode]); return txHash; },
    });
    await expect(flow.start('form', io)).resolves.toEqual({
      step: 'late', late: true, id: 'preparation-1', deadline: 259201n,
    });
    await flow.start('edited form', io);
    expect(sends).toEqual([]);
    await expect(flow.recordLate()).resolves.toMatchObject({ step: 'anchored', txHash });
    expect(prepareCount).toBe(1);
    expect(sends).toHaveLength(1);
    expect(sends[0][0]).toBe(prepared);
    expect(sends[0][1]).toBe('late');
  });

  it('confirms a mined revert with B but never reports it as anchored', async () => {
    const flow = transaction();
    const confirmations: string[] = [];
    const io = transactionIO({
      wait: async () => 'reverted',
      confirm: async (id) => { confirmations.push(id); return { status: 'failed', reason: 'Contract reverted.' }; },
    });
    await expect(flow.start('form', io)).resolves.toMatchObject({
      step: 'failed', txHash, error: { code: 'reverted', message: 'Contract reverted.' },
    });
    expect(confirmations).toEqual(['preparation-1']);
  });

  it.each([
    [Object.assign(new Error('cancelled'), { code: 4001 }), 'rejected'],
    [Object.assign(new Error('nonce too low'), { name: 'NonceTooLowError' }), 'nonce'],
  ])('classifies a wallet write failure without a hash as %s', async (failure, code) => {
    const flow = transaction();
    await expect(flow.start('form', transactionIO({
      send: async () => { throw new Error('wallet write failed', { cause: failure }); },
    }))).resolves.toMatchObject({ step: 'failed', canReconfirm: false, error: { code } });
  });
});
