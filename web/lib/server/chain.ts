import 'server-only';
import { decodeFunctionData, getAbiItem, type Abi, type Hex } from 'viem';
import { z } from 'zod';
import { accessAbi, breachAbi, registryAbi } from '../shared/abi';
import { getReceiptRobust, getTransactionRobust, publicClient } from '../shared/chain';
import { HttpError } from './http';
export const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((value) => value.toLowerCase() as Hex);
export const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform((value) => value.toLowerCase() as Hex);
export const events = [
  getAbiItem({ abi: accessAbi, name: 'AccessLogged' }),
  getAbiItem({ abi: breachAbi, name: 'BreachAnchored' }),
  getAbiItem({ abi: breachAbi, name: 'LateBreachAnchored' }),
  getAbiItem({ abi: registryAbi, name: 'ControllerRegistered' }),
  getAbiItem({ abi: registryAbi, name: 'ControllerRevoked' }),
] as const;
// Configuration errors are plain Errors (logged and returned as 503), never ZodErrors that read as bad client input.
function setting<T extends z.ZodType>(name: string, value: string | undefined, schema: T): z.output<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`${name} is missing or invalid in the server environment.`);
  return parsed.data;
}
// Keep the literal process.env.NEXT_PUBLIC_* reads: Next.js inlines them at build time.
export function addresses() {
  return { journal: setting('NEXT_PUBLIC_JOURNAL_ADDRESS', process.env.NEXT_PUBLIC_JOURNAL_ADDRESS, address),
    breach: setting('NEXT_PUBLIC_BREACH_ADDRESS', process.env.NEXT_PUBLIC_BREACH_ADDRESS, address),
    registry: setting('NEXT_PUBLIC_REGISTRY_ADDRESS', process.env.NEXT_PUBLIC_REGISTRY_ADDRESS, address) };
}
export function deployBlock() { return BigInt(setting('NEXT_PUBLIC_DEPLOY_BLOCK', process.env.NEXT_PUBLIC_DEPLOY_BLOCK, z.string().regex(/^[0-9]+$/))); }
export function rpc() {
  if (!publicClient) throw new Error('Sepolia RPC is not configured.');
  return publicClient;
}
// Load-balanced RPCs can return a receipt before every backend has the block; treat that as "not yet".
export async function blockByHash(blockHash: Hex) {
  try { return await rpc().getBlock({ blockHash }); } catch (error) {
    if (error instanceof Error && error.name === 'BlockNotFoundError') return null;
    throw error;
  }
}
export async function receipt(txHash: Hex) {
  rpc();
  return (await getReceiptRobust(txHash)).receipt;
}
export async function transaction(txHash: Hex) {
  rpc();
  return getTransactionRobust(txHash);
}

type Wait = (ms: number) => Promise<void>;
const sleep: Wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
type SubmittedTx = { to: Hex | null; from: Hex; input: Hex };
// The wallet returns the hash as soon as it broadcasts; public RPCs usually see the pending transaction within 1-3 s.
// Each lookup is capped by the 4 s RPC timeout, so the whole wait stays under the client's 15 s request timeout.
export async function visibleTransaction(txHash: Hex, options: { windowMs?: number; delayMs?: number; attempts?: number; wait?: Wait;
  find?: (txHash: Hex) => Promise<{ transaction: SubmittedTx | null }> } = {}) {
  const { windowMs = 8_000, delayMs = 1_000, attempts = 8, wait = sleep, find = transaction } = options;
  const deadline = Date.now() + windowMs;
  for (let attempt = 1; ; attempt++) {
    const { transaction: found } = await find(txHash);
    if (found) return found;
    if (attempt >= attempts || Date.now() + delayMs >= deadline) return null;
    await wait(delayMs);
  }
}

const same = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase()
  : (typeof a === 'bigint' || typeof a === 'number') && (typeof b === 'bigint' || typeof b === 'number') && BigInt(a) === BigInt(b);
// True when the transaction calls `target` with one of `functionNames` and exactly the prepared draft's arguments.
export function callMatchesDraft(tx: Pick<SubmittedTx, 'to' | 'input'>, target: Hex, abi: Abi, functionNames: readonly string[], expected: readonly unknown[]) {
  if (!tx.to || tx.to.toLowerCase() !== target.toLowerCase()) return false;
  try {
    const { functionName, args } = decodeFunctionData({ abi, data: tx.input });
    const actual: readonly unknown[] = args ?? [];
    return functionNames.includes(functionName) && actual.length === expected.length && actual.every((value, index) => same(value, expected[index]));
  } catch { return false; }
}

// Submit only accepts a transaction hash the chain has seen, sent to the right contract with the draft's arguments,
// so a citizen code alone cannot plant a "submitted" receipt with a made-up hash.
export async function verifySubmission(txHash: Hex, target: Hex, abi: Abi, functionNames: readonly string[], expected: readonly [Hex, ...unknown[]]) {
  const tx = await visibleTransaction(txHash);
  if (!tx) throw new HttpError(409, 'TX_NOT_VISIBLE', 'Sepolia does not show this transaction yet. Wait a few seconds, then press Reconfirm.');
  if (!callMatchesDraft(tx, target, abi, functionNames, expected)) throw new HttpError(400, 'TX_MISMATCH', 'The transaction does not match this draft.');
  // The contracts enforce authorization too; this only rejects early. An RPC failure here is not the sender's fault.
  const authorized = await rpc().readContract({ address: addresses().registry, abi: registryAbi, functionName: 'isAuthorized', args: [expected[0], tx.from] })
    .catch(() => true);
  if (!authorized) throw new HttpError(403, 'TX_NOT_AUTHORIZED', 'The sending wallet is not authorized for this controller.');
}

// A submitted row whose transaction no Sepolia node knows ~10 minutes after the draft was prepared was dropped or
// never broadcast. RPC errors and timeouts never count as "unknown", so an outage cannot fail honest receipts.
export const STALE_SUBMISSION_MS = 10 * 60_000;
export async function unknownTransaction(txHash: string, createdAt: Date, options: { now?: number; find?: typeof transaction } = {}) {
  const { now = Date.now(), find = transaction } = options;
  if (now - createdAt.getTime() < STALE_SUBMISSION_MS) return false;
  const { transaction: found, missing } = await find(hash.parse(txHash));
  return !found && missing;
}
