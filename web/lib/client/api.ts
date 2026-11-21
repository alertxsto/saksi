import { TransactionFlowError, type Confirmation } from './transactions';

// Fetch helpers for the controller API, kept free of React and wagmi so they can be tested directly.
export type Resource = 'access' | 'breach';
export type Action = 'prepare' | 'submit' | 'confirm';
type Wait = (ms: number) => Promise<void>;

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
export const invalidResponse = () => new TransactionFlowError('api', 'The controller service returned an invalid response.');
const unavailable = (action: Action) => new TransactionFlowError('api', `The controller service could not ${action} the transaction.`);

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

// The server only accepts a hash Sepolia already shows (it waits up to ~8 s). A fresh broadcast can take longer to
// reach the server's RPCs, so retry a few times on TX_NOT_VISIBLE before handing the user a Reconfirm.
export async function submission(resource: Resource, body: object, options: { attempts?: number; delayMs?: number; wait?: Wait } = {}) {
  const { attempts = 4, delayMs = 2_000, wait = sleep } = options;
  for (let attempt = 1; ; attempt++) {
    try {
      return await post(resource, 'submit', body);
    } catch (error) {
      if (!(error instanceof TransactionFlowError) || error.apiCode !== 'TX_NOT_VISIBLE' || attempt >= attempts) throw error;
    }
    await wait(delayMs);
  }
}

// The browser can see a receipt on one load-balanced RPC backend before the server's RPCs do. The server
// then answers `submitted`, which means "not visible yet", so poll a few times before giving up.
export async function confirmation(resource: Resource, id: string, options: { attempts?: number; delayMs?: number; wait?: Wait } = {}): Promise<Confirmation> {
  const { attempts = 6, delayMs = 2_000, wait = sleep } = options;
  for (let attempt = 1; ; attempt++) {
    const { status, reason } = await responseObject(await post(resource, 'confirm', { id }));
    if (status === 'anchored') return { status };
    if (status === 'failed' && (reason === undefined || typeof reason === 'string')) return { status, reason };
    if (status !== 'submitted') throw invalidResponse();
    if (attempt >= attempts) {
      throw new TransactionFlowError('unconfirmed', 'The Saksi server cannot see this transaction on Sepolia yet. Wait a few seconds, then press Reconfirm.');
    }
    await wait(delayMs);
  }
}
