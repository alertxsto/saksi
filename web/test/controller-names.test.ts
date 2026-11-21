import { describe, expect, it } from 'vitest';
import { keccak256, toBytes } from 'viem';
import { controllerDisplayName } from '../lib/shared/controller-names';

const id = (slug: string) => keccak256(toBytes(`ctrl:${slug}`));

describe('controllerDisplayName', () => {
  it('renames the first three controllers, whatever the case of the id', () => {
    expect(controllerDisplayName(id('demo-one'), 'Demo One')).toBe('Bank Kredit Contoh (fiktif)');
    expect(controllerDisplayName(id('demo-spare').toUpperCase().replace('0X', '0x'), 'Demo Spare')).toBe('Fintech Contoh (fiktif)');
  });
  it('keeps the registered name for every other controller', () => {
    expect(controllerDisplayName(id('rsud-contoh'), 'RSUD Contoh (fiktif)')).toBe('RSUD Contoh (fiktif)');
    expect(controllerDisplayName(id('rsud-contoh'), undefined)).toBeUndefined();
  });
});
