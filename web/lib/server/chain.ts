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
export function addresses() {
  return { journal: address.parse(process.env.NEXT_PUBLIC_JOURNAL_ADDRESS), breach: address.parse(process.env.NEXT_PUBLIC_BREACH_ADDRESS), registry: address.parse(process.env.NEXT_PUBLIC_REGISTRY_ADDRESS) };
}
export function deployBlock() { return BigInt(z.string().regex(/^[0-9]+$/).parse(process.env.NEXT_PUBLIC_DEPLOY_BLOCK)); }
export function rpc() {
  if (!publicClient) throw new Error('Sepolia RPC is not configured.');
  return publicClient;
}
export async function receipt(txHash: Hex) {
  rpc();
  return (await getReceiptRobust(txHash)).receipt;
}
