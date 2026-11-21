import { expect, test } from 'vitest';
import { controllerLinkForCode, normalizeCitizenCode, rpcLabel } from '../lib/format';

test('rpcLabel names the node provider without protocol or subdomains', () => {
  expect(rpcLabel('https://ethereum-sepolia-rpc.publicnode.com')).toBe('publicnode');
  expect(rpcLabel('https://sepolia.gateway.tenderly.co/abc')).toBe('tenderly');
  expect(rpcLabel('https://1rpc.io/sepolia')).toBe('1rpc');
  expect(rpcLabel('http://localhost:8545')).toBe('localhost');
  expect(rpcLabel('http://127.0.0.1:8545')).toBe('127.0.0.1');
  expect(rpcLabel('not a url')).toBe('not a url');
});

test('normalizeCitizenCode upper-cases, strips separators and caps at 6', () => {
  expect(normalizeCitizenCode(' 4ue-65y ')).toBe('4UE65Y');
  expect(normalizeCitizenCode('k7m2qdEXTRA')).toBe('K7M2QD');
  expect(normalizeCitizenCode(null)).toBe('');
  expect(normalizeCitizenCode('<script>')).toBe('SCRIPT');
});

test('controllerLinkForCode builds an absolute console link', () => {
  expect(controllerLinkForCode('https://saksiku.web.id', '4ue65y')).toBe('https://saksiku.web.id/controller?code=4UE65Y');
  expect(controllerLinkForCode('https://saksiku.web.id/', 'K7M2QD')).toBe('https://saksiku.web.id/controller?code=K7M2QD');
});
