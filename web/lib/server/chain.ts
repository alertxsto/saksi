import 'server-only';
import { getAbiItem, type Hex } from 'viem';
import { z } from 'zod';
import { accessAbi, breachAbi, registryAbi } from '../shared/abi';
import { getReceiptRobust, publicClient } from '../shared/chain';
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
export async function receipt(txHash: Hex) {
  rpc();
  return (await getReceiptRobust(txHash)).receipt;
}
