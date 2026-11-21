import 'server-only';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import type { Hex } from 'viem';
function key(name: 'SUBJECT_KEY' | 'DATA_KEY'): Buffer {
  const value = process.env[name];
  if (!value || !/^(0x)?[0-9a-f]{64}$/i.test(value)) throw new Error(name + ' must contain 32 hex bytes.');
  return Buffer.from(value.replace(/^0x/i, ''), 'hex');
}
function bytes32(value: Hex): Buffer {
  if (!/^0x[0-9a-f]{64}$/i.test(value)) throw new TypeError('Expected 32 hex bytes.');
  return Buffer.from(value.slice(2), 'hex');
}
export function pseudonym(controllerId: Hex, subjectId: string, salt: Hex): Hex {
  return '0x' + createHmac('sha256', key('SUBJECT_KEY')).update(bytes32(controllerId)).update(subjectId, 'utf8').update(bytes32(salt)).digest('hex') as Hex;
}
export function randomSalt32(): Hex { return '0x' + randomBytes(32).toString('hex') as Hex; }
export function encrypt(value: string): { ciphertext: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key('DATA_KEY'), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return { ciphertext: ciphertext.toString('base64url'), iv: iv.toString('base64url') };
}
export function decrypt(ciphertext: string, iv: string): string {
  const data = Buffer.from(ciphertext, 'base64url');
  if (data.length < 16) throw new TypeError('Invalid encrypted value.');
  const decipher = createDecipheriv('aes-256-gcm', key('DATA_KEY'), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]).toString('utf8');
}
