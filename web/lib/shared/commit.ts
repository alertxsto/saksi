import serialize from 'canonicalize';
import { concat, keccak256, numberToBytes, stringToHex, toBytes, type Hex } from 'viem';
import type { LEGAL_BASES } from './types';
export function canonicalize(value: unknown): string {
  const json = serialize(value);
  if (json === undefined) throw new TypeError('Expected a JSON value.');
  return json;
}
export const controllerId = (slug: string) => keccak256(toBytes('ctrl:' + slug));
export const purposeHash = (text: string, salt: Hex) => keccak256(concat([toBytes(text), toBytes(salt)]));
export const legalBasisKey = (key: keyof typeof LEGAL_BASES) => stringToHex(key, { size: 32 });
export const evidenceHash = (evidence: unknown) => keccak256(toBytes(canonicalize(evidence)));
export const reportHash = evidenceHash;
export const affectedCountHash = (count: number, salt: Hex) => keccak256(concat([numberToBytes(count, { size: 32 }), toBytes(salt)]));
