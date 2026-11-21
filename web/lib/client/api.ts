import { TransactionFlowError, type Confirmation } from './transactions';

// Fetch helpers for the controller API, kept free of React and wagmi so they can be tested directly.
export type Resource = 'access' | 'breach';
export type Action = 'prepare' | 'submit' | 'confirm';
type Wait = (ms: number) => Promise<void>;

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
export const invalidResponse = () => new TransactionFlowError('api', 'The controller service returned an invalid response.');
// NETWORK marks transport failures and non-JSON proxy errors, which are worth retrying (see keepTrying).
const unavailable = (action: Action) => new TransactionFlowError('api', `The controller service could not ${action} the transaction.`, 'NETWORK');

// API errors carry an English, UI-safe message (see ApiError in lib/shared/types.ts); show it and keep its code.
async function apiError(response: Response, action: Action) {
  try {
    const body: unknown = await response.json();
    if (isObject(body) && isObject(body.error)) {
      const { code, message } = body.error;
      if (typeof code === 'string' && /^[A-Z_]{1,40}$/.test(code) && typeof message === 'string' && message.length > 0 && message.length <= 300) {
        return new TransactionFlowError('api', message, code);
      }
    }
  } catch { /* Not a JSON error body (for example a proxy error page). */ }
  return unavailable(action);
}

export async function post(resource: Resource, action: Action, body: object) {
  let response: Response;
  try {
    response = await fetch(`/api/controller/${resource}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch { throw unavailable(action); /* Keep transport details and request data out of UI errors. */ }
  if (response.ok) return response;
  throw await apiError(response, action);
}

export async function responseObject(response: Response) {
  let value: unknown;
  try { value = await response.json(); } catch { throw invalidResponse(); }
  if (!isObject(value)) throw invalidResponse();
  return value;
}

const sleep: Wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

type RetryOptions = { attempts?: number; delayMs?: number; maxDelayMs?: number; timeoutMs?: number; wait?: Wait; now?: () => number };

// Transient answers worth waiting out: the server cannot see the tx yet, a proxy/RPC hiccup, a rate limit, or a
// transport error (NETWORK). Anything with another API code (TX_MISMATCH, SUBMIT_TOKEN_INVALID...) is final.
const RETRYABLE = new Set(['TX_NOT_VISIBLE', 'UNAVAILABLE', 'RATE_LIMITED', 'NETWORK']);
const transient = (error: unknown) => error instanceof TransactionFlowError && error.apiCode !== undefined && RETRYABLE.has(error.apiCode);

// Retries on its own for up to `timeoutMs` (3 min by default) with a gentle backoff, so the person in front of
// the screen never has to press anything while Sepolia and the RPCs catch up.
async function keepTrying<T>(step: () => Promise<T | undefined>, giveUp: () => Error, options: RetryOptions): Promise<T> {
  const { attempts = Infinity, delayMs = 2_000, maxDelayMs = 5_000, timeoutMs = 180_000, wait = sleep, now = Date.now } = options;
  const deadline = now() + timeoutMs;
  for (let attempt = 1, delay = delayMs; ; attempt++, delay = Math.min(maxDelayMs, Math.round(delay * 1.5))) {
    let last: unknown;
    try {
      const value = await step();
      if (value !== undefined) return value;
    } catch (error) {
      if (!transient(error)) throw error;
      last = error;
    }
    if (attempt >= attempts || now() + delay > deadline) throw giveUp();
    await wait(delay);
  }
}

// The server only accepts a hash Sepolia already shows (it waits up to ~8 s per call). A fresh broadcast can take
// longer to reach the server's RPCs, so keep resubmitting the same hash until it is seen.
export async function submission(resource: Resource, body: object, options: RetryOptions = {}) {
  return keepTrying(() => post(resource, 'submit', body),
    () => new TransactionFlowError('unconfirmed', 'Sepolia has not shown this transaction for 3 minutes. It is kept; Saksi checks it again when you reopen this page.', 'TX_NOT_VISIBLE'),
    options);
}

// The browser can see a receipt on one load-balanced RPC backend before the server's RPCs do. The server then
// answers `submitted` ("not visible yet"), so keep polling until it settles.
export async function confirmation(resource: Resource, id: string, options: RetryOptions = {}): Promise<Confirmation> {
  return keepTrying<Confirmation>(async () => {
    const { status, reason } = await responseObject(await post(resource, 'confirm', { id }));
    if (status === 'anchored') return { status };
    if (status === 'failed' && (reason === undefined || typeof reason === 'string')) return { status, reason };
    if (status !== 'submitted') throw invalidResponse();
    return undefined;
  }, () => new TransactionFlowError('unconfirmed', 'Sepolia is slow right now. The record is kept and confirms on its own once the network catches up.'), options);
}
