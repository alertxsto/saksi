import { BaseError, ContractFunctionRevertedError, type Hash } from 'viem';

type Mode = 'on_time' | 'late';
type Preparation = { id: string };
type Submission = { id: string; txHash: Hash };
type ReceiptStatus = 'success' | 'reverted';
type LateApproval = { late: true; deadline: bigint };
export type Confirmation = { status: 'anchored' } | { status: 'failed'; reason?: string };
export type TransactionError = {
  code: 'wallet' | 'rejected' | 'nonce' | 'timeout' | 'reverted' | 'api' | 'unconfirmed' | 'unknown';
  message: string;
};
export type TransactionState =
  | { step: 'idle' | 'preparing' }
  | ({ step: 'simulating' | 'signing' } & Preparation)
  | ({ step: 'late' } & Preparation & LateApproval)
  | ({ step: 'submitting' | 'waiting' | 'confirming' | 'anchored' } & Submission)
  | {
    step: 'failed';
    id?: string;
    txHash?: Hash;
    error: TransactionError;
    canReconfirm: boolean;
    lateApproval?: LateApproval;
  };

export type TransactionIO<Input, Prepared extends Preparation> = {
  prepare(input: Input): Promise<Prepared>;
  simulate?(prepared: Prepared, mode: Mode): Promise<void>;
  send(prepared: Prepared, mode: Mode): Promise<Hash>;
  submit(id: string, txHash: Hash): Promise<void>;
  wait(txHash: Hash): Promise<ReceiptStatus>;
  confirm(id: string): Promise<Confirmation>;
};

export class TransactionFlowError extends Error {
  constructor(readonly code: TransactionError['code'], message: string) {
    super(message);
  }
}

function explainError(error: unknown): TransactionError {
  for (let depth = 0; depth < 12 && error && typeof error === 'object'; depth++) {
    if (error instanceof TransactionFlowError) return { code: error.code, message: error.message };
    const cause = error as { name?: string; message?: string; code?: unknown; cause?: unknown };
    const name = typeof cause.name === 'string' ? cause.name : '';
    const message = typeof cause.message === 'string' ? cause.message : '';
    if (cause.code === 4001 || /UserRejected|UserDenied/.test(name)) {
      return { code: 'rejected', message: 'The wallet request was rejected. No transaction was sent.' };
    }
    if (/Nonce|ReplacementUnderpriced/.test(name) || /nonce too (low|high)|replacement transaction underpriced|nonce has already been used/i.test(message)) {
      return { code: 'nonce', message: 'Check for pending transactions in your wallet before trying again.' };
    }
    if (/Timeout|TimedOut/.test(name) || cause.code === 'ETIMEDOUT' || /timed? out|timeout/i.test(message)) {
      return { code: 'timeout', message: 'The RPC timed out. Check your wallet for a pending transaction.' };
    }
    if (/Revert/.test(name) || /execution reverted/i.test(message)) {
      return { code: 'reverted', message: 'The transaction reverted.' };
    }
    error = cause.cause;
  }
  return { code: 'unknown', message: 'The transaction could not be completed.' };
}

function expiredDeadline(error: unknown): bigint | undefined {
  if (!(error instanceof BaseError)) return undefined;
  const revert = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
  if (!(revert instanceof ContractFunctionRevertedError) || revert.data?.errorName !== 'ClaimedWindowExpired') {
    return undefined;
  }
  const deadline = revert.data.args?.[1];
  return typeof deadline === 'bigint' ? deadline : undefined;
}

export function createTransactionFlow<Input, Prepared extends Preparation>(notify: (state: TransactionState) => void) {
  type IO = TransactionIO<Input, Prepared>;
  type Known = Submission & Pick<IO, 'submit' | 'confirm'> & {
    submitted: boolean;
    receiptStatus?: ReceiptStatus;
    settled: boolean;
  };

  let state: TransactionState = { step: 'idle' };
  let running: Promise<TransactionState> | undefined;
  let pendingLate: { prepared: Prepared; io: IO; approval: LateApproval } | undefined;
  let known: Known | undefined;

  function set(next: TransactionState) {
    state = next;
    notify(next);
  }

  function run(work: () => Promise<void>) {
    if (running) return running;
    running = Promise.resolve().then(work).then(() => state).finally(() => { running = undefined; });
    return running;
  }

  function fail(error: TransactionError, id?: string) {
    set({
      step: 'failed', id, txHash: known?.txHash, error,
      canReconfirm: known !== undefined,
      lateApproval: pendingLate?.approval,
    });
  }

  async function submit(transaction: Known) {
    const { id, txHash } = transaction;
    set({ step: 'submitting', id, txHash });
    await transaction.submit(id, txHash);
    transaction.submitted = true;
  }

  async function confirm(transaction: Known) {
    const { id, txHash } = transaction;
    set({ step: 'confirming', id, txHash });
    const result = await transaction.confirm(id);
    transaction.settled = result.status === 'anchored' || transaction.receiptStatus !== undefined;
    if (transaction.receiptStatus === 'reverted') {
      const reason = result.status === 'failed' ? result.reason : undefined;
      fail({ code: 'reverted', message: reason ?? 'The transaction reverted.' }, id);
    } else if (result.status === 'failed') {
      fail({ code: 'unconfirmed', message: result.reason ?? 'The controller service could not confirm the transaction.' }, id);
    } else {
      set({ step: 'anchored', id, txHash });
    }
  }

  async function send(prepared: Prepared, io: IO, mode: Mode) {
    const { id } = prepared;
    try {
      if (io.simulate) {
        set({ step: 'simulating', id });
        try {
          await io.simulate(prepared, mode);
        } catch (error) {
          const deadline = mode === 'on_time' ? expiredDeadline(error) : undefined;
          if (deadline === undefined) throw error;
          const approval: LateApproval = { late: true, deadline };
          pendingLate = { prepared, io, approval };
          set({ step: 'late', id, ...approval });
          return;
        }
      }
      set({ step: 'signing', id });
      const txHash = await io.send(prepared, mode);
      pendingLate = undefined;
      const transaction: Known = { id, txHash, submit: io.submit, confirm: io.confirm, submitted: false, settled: false };
      known = transaction;
      await submit(transaction);
      set({ step: 'waiting', id, txHash });
      transaction.receiptStatus = await io.wait(txHash);
      await confirm(transaction);
    } catch (error) {
      fail(explainError(error), id);
    }
  }

  return {
    start(input: Input, io: IO) {
      if (running) return running;
      if (known || pendingLate) return Promise.resolve(state);
      return run(async () => {
        set({ step: 'preparing' });
        try {
          const prepared = await io.prepare(input);
          await send(prepared, io, 'on_time');
        } catch (error) {
          fail(explainError(error));
        }
      });
    },
    recordLate() {
      const pending = pendingLate;
      return pending ? run(() => send(pending.prepared, pending.io, 'late')) : running ?? Promise.resolve(state);
    },
    reconfirm() {
      const transaction = known;
      if (running) return running;
      if (!transaction || state.step === 'anchored') return Promise.resolve(state);
      return run(async () => {
        try {
          if (!transaction.submitted) await submit(transaction);
          await confirm(transaction);
        } catch (error) {
          fail(explainError(error), transaction.id);
        }
      });
    },
    reset() {
      if (running || known && !known.settled) return false;
      pendingLate = undefined;
      known = undefined;
      set({ step: 'idle' });
      return true;
    },
  };
}
