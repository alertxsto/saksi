import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Hash } from 'viem';
import { confirmation, post } from '../lib/client/api';
import { createTransactionFlow, TransactionFlowError, type TransactionIO } from '../lib/client/transactions';
import { walletStatus, type WalletInputs } from '../lib/client/wallet-status';

const txHash: Hash = `0x${'ab'.repeat(32)}`;
const reply = (status: number, body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), {
  status, headers: { 'content-type': typeof body === 'string' ? 'text/html' : 'application/json' } });
function serve(...responses: (Response | Error)[]) {
  const fetch = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
afterEach(() => { vi.unstubAllGlobals(); });

describe('controller API errors', () => {
  it('shows the API message and keeps its code', async () => {
    serve(reply(404, { error: { code: 'UNKNOWN_CITIZEN', message: "We couldn't find that citizen code" } }));
    const error = await post('access', 'prepare', {}).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TransactionFlowError);
    expect(error).toMatchObject({ code: 'api', apiCode: 'UNKNOWN_CITIZEN', message: "We couldn't find that citizen code" });
  });

  it('falls back to the generic message for non-JSON bodies and network failures', async () => {
    serve(reply(502, '<html>Bad gateway</html>'), new TypeError('Failed to fetch'));
    await expect(post('breach', 'submit', {})).rejects.toMatchObject({ code: 'api', apiCode: 'NETWORK',
      message: 'The controller service could not submit the transaction.' });
    await expect(post('breach', 'prepare', {})).rejects.toMatchObject({ code: 'api',
      message: 'The controller service could not prepare the transaction.' });
  });

  it('carries the API code into the flow state', async () => {
    serve(reply(400, { error: { code: 'FUTURE_DETECTION', message: 'Detection time cannot be in the future.' } }));
    const flow = createTransactionFlow<string, { id: string }>(() => {});
    const io: TransactionIO<string, { id: string }> = {
      prepare: async () => { await post('breach', 'prepare', {}); return { id: 'never' }; },
      send: async () => txHash, submit: async () => {}, wait: async () => 'success', confirm: async () => ({ status: 'anchored' }),
    };
    await expect(flow.start('form', io)).resolves.toEqual({ step: 'failed', id: undefined, txHash: undefined, canReconfirm: false,
      lateApproval: undefined, error: { code: 'api', apiCode: 'FUTURE_DETECTION', message: 'Detection time cannot be in the future.' } });
  });
});

describe('confirm while the server RPC lags', () => {
  it('treats submitted as not yet visible and polls until anchored', async () => {
    const fetch = serve(reply(200, { status: 'submitted' }), reply(200, { status: 'submitted' }), reply(200, { status: 'anchored' }));
    const wait = vi.fn(async () => {});
    await expect(confirmation('access', 'draft-1', { wait })).resolves.toEqual({ status: 'anchored' });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(2_000);
  });

  it('only gives up after the retry budget, and a later check anchors the same transaction', async () => {
    serve(...Array.from({ length: 3 }, () => reply(200, { status: 'submitted' })), reply(200, { status: 'anchored' }));
    const sends: Hash[] = [];
    const flow = createTransactionFlow<string, { id: string }>(() => {});
    const io: TransactionIO<string, { id: string }> = {
      prepare: async () => ({ id: 'draft-1' }),
      send: async () => { sends.push(txHash); return txHash; },
      submit: async () => {},
      wait: async () => 'success',
      confirm: (id) => confirmation('access', id, { attempts: 3, wait: async () => {} }),
    };
    await expect(flow.start('form', io)).resolves.toMatchObject({ step: 'failed', txHash, canReconfirm: true,
      error: { code: 'unconfirmed', message: expect.stringContaining('confirms on its own') } });
    await expect(flow.reconfirm()).resolves.toEqual({ step: 'anchored', id: 'draft-1', txHash });
    expect(sends).toEqual([txHash]);
  });

  it('still rejects statuses the API never sends', async () => {
    serve(reply(200, { status: 'mystery' }));
    await expect(confirmation('breach', 'draft-1', { wait: async () => {} })).rejects.toMatchObject({
      message: 'The controller service returned an invalid response.' });
  });
});

describe('wallet status', () => {
  const address = '0x0000000000000000000000000000000000000002';
  const registered = { controllerId: `0x${'01'.repeat(32)}`, name: 'Demo One', balance: 10n ** 16n } as const;
  const inputs: WalletInputs = { injectedWallet: true, isConnected: true, address, chainId: 11155111,
    expectedChainId: 11155111, minimumBalance: 2n * 10n ** 15n, registry: registered };

  it('keeps a registered wallet ready when only a background refetch failed', () => {
    // React Query keeps `data` from the last success after a failed refetch; status follows the data.
    expect(walletStatus(inputs)).toEqual({ state: 'ready', address, ...registered });
  });

  it('distinguishes not registered, unknown, low gas, wrong network and no wallet', () => {
    expect(walletStatus({ ...inputs, registry: null })).toEqual({ state: 'not_registered', address });
    expect(walletStatus({ ...inputs, registry: undefined })).toEqual({ state: 'not_registered', address });
    expect(walletStatus({ ...inputs, registry: { ...registered, balance: 1n } }).state).toBe('no_gas');
    expect(walletStatus({ ...inputs, chainId: 1 })).toEqual({ state: 'wrong_network', address, chainId: 1 });
    expect(walletStatus({ ...inputs, injectedWallet: false })).toEqual({ state: 'no_wallet' });
    expect(walletStatus({ ...inputs, isConnected: false })).toEqual({ state: 'disconnected' });
  });
});
