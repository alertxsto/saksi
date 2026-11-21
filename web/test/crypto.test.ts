import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { decrypt, encrypt, pseudonym, randomSalt32 } from '../lib/server/crypto';
import type { Hex } from 'viem';
afterEach(() => vi.unstubAllEnvs());
it('encrypts UTF-8 with distinct IVs and rejects corrupted evidence', () => {
  vi.stubEnv('DATA_KEY', 'ab'.repeat(32));
  const first = encrypt('synthetic: é');
  const second = encrypt('synthetic: é');
  expect(first.iv).not.toBe(second.iv);
  expect(decrypt(first.ciphertext, first.iv)).toBe('synthetic: é');
  const corrupted = Buffer.from(first.ciphertext, 'base64url');
  corrupted[0] ^= 0x80;
  expect(() => decrypt(corrupted.toString('base64url'), first.iv)).toThrow();
});
it('binds pseudonyms to the controller and subject salt', () => {
  vi.stubEnv('SUBJECT_KEY', 'cd'.repeat(32));
  const alpha = ('0x' + '01'.repeat(32)) as Hex;
  const beta = ('0x' + '02'.repeat(32)) as Hex;
  expect(randomSalt32()).toMatch(/^0x[0-9a-f]{64}$/);
  expect(pseudonym(alpha, 'subject-a', beta)).not.toBe(pseudonym(beta, 'subject-a', beta));
  expect(pseudonym(alpha, 'subject-a', beta)).not.toBe(pseudonym(alpha, 'subject-a', alpha));
});
