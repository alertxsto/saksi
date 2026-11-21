import { expect, test } from 'vitest';
import type { Hex } from 'viem';
import { affectedCountHash, canonicalize, controllerId, evidenceHash, legalBasisKey, purposeHash } from '../lib/shared/commit';

const zeroSalt = `0x${'00'.repeat(32)}` as Hex;

test('matches the contract deployment controller ID and fixed commitment vectors', () => {
  expect(controllerId('demo-one')).toBe('0x81d37ea3558b4d7aaa6fe7db776b0bcd7b6c8cc9a7cb87b6948b92e10fa01246');
  expect(purposeHash('', zeroSalt)).toBe('0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563');
  expect(affectedCountHash(0, zeroSalt)).toBe('0xad3228b676f7d3cd4284a5443f17f1962b36e491b30a40b2405849e597ba5fb5');
  expect(legalBasisKey('PDP-20-2-f')).toBe('0x5044502d32302d322d66' + '00'.repeat(22));
});

test('canonicalizes nested UTF-8 evidence without changing array order', () => {
  const evidence = { z: [{ b: 2, a: 1 }, 'é'], a: 'demo' };
  expect(canonicalize(evidence)).toBe('{"a":"demo","z":[{"a":1,"b":2},"é"]}');
  expect(evidenceHash(evidence)).toBe(evidenceHash({ a: 'demo', z: [{ a: 1, b: 2 }, 'é'] }));
  expect(evidenceHash(evidence)).not.toBe(evidenceHash({ a: 'demo', z: ['é', { a: 1, b: 2 }] }));
});
