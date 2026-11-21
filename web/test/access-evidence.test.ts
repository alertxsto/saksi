import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { Hex } from 'viem';
import { accessEvidence, accessInput } from '../lib/server/access';
import { inferSlug } from '../lib/server/registry';
import { controllerId, evidenceHash } from '../lib/shared/commit';

const id = controllerId('rsud-contoh');
const base = { controllerId: id, subjectCode: 'jvhulk', purposeText: 'Opened the patient record', legalBasisKey: 'PDP-20-2-e', eventType: 0 };
const at = new Date('2026-11-22T01:00:00Z');
const nonce = `0x${'11'.repeat(32)}`;

describe('accessInput evidence fields', () => {
  it('keeps old clients working: system, dataCategories and operatorRef are optional', () => {
    const parsed = accessInput.parse(base);
    expect(parsed.subjectCode).toBe('JVHULK');
    expect(parsed.system).toBeUndefined();
    expect(parsed.dataCategories).toBeUndefined();
    expect(parsed.operatorRef).toBeUndefined();
  });

  it('accepts the category enum and rejects unknown, empty or extra fields', () => {
    expect(accessInput.parse({ ...base, system: ' SIMRS ', dataCategories: ['health', 'identity'], operatorRef: 'desk-07' }))
      .toMatchObject({ system: 'SIMRS', dataCategories: ['health', 'identity'], operatorRef: 'desk-07' });
    expect(accessInput.safeParse({ ...base, dataCategories: [] }).success).toBe(false);
    expect(accessInput.safeParse({ ...base, dataCategories: ['phone'] }).success).toBe(false);
    expect(accessInput.safeParse({ ...base, system: '' }).success).toBe(false);
    expect(accessInput.safeParse({ ...base, system: 'x'.repeat(81) }).success).toBe(false);
    expect(accessInput.safeParse({ ...base, nik: '3171' }).success).toBe(false);
  });

  it('keeps operatorRef to a short desk or role token, so a full name does not fit', () => {
    expect(accessInput.safeParse({ ...base, operatorRef: 'Budi Santoso' }).success).toBe(false);
    expect(accessInput.safeParse({ ...base, operatorRef: 'a'.repeat(33) }).success).toBe(false);
    expect(accessInput.safeParse({ ...base, operatorRef: 'officer.2' }).success).toBe(true);
  });
});

describe('accessEvidence', () => {
  it('records what the client sent, in canonical category order', () => {
    const input = accessInput.parse({ ...base, eventType: 3, system: 'SIMRS', dataCategories: ['health', 'identity', 'health'], operatorRef: 'desk-07' });
    expect(accessEvidence(input, 'RSUD Contoh (fiktif)', 'e1', nonce, at)).toEqual({
      v: 2, eventId: 'e1', nonce, controllerId: id, system: 'SIMRS', dataCategories: ['identity', 'health'],
      operatorRef: 'desk-07', requestedAt: '2026-11-22T01:00:00.000Z',
    });
  });

  it('defaults system to the registered controller name and operatorRef to "officer", never to a fixed system', () => {
    const evidence = accessEvidence(accessInput.parse(base), 'Disdukcapil Kota Contoh (fiktif)', 'e2', nonce, at);
    expect(evidence.system).toBe('Disdukcapil Kota Contoh (fiktif)');
    expect(evidence.operatorRef).toBe('officer');
    expect(evidence.dataCategories).toEqual(['identity']);
    expect(JSON.stringify(evidence)).not.toMatch(/core-banking|synthetic-operator/);
  });

  it('changes the on-chain evidence hash when the declared categories change', () => {
    const a = accessEvidence(accessInput.parse({ ...base, dataCategories: ['identity'] }), 'X', 'e3', nonce, at);
    const b = accessEvidence(accessInput.parse({ ...base, dataCategories: ['identity', 'health'] }), 'X', 'e3', nonce, at);
    expect(evidenceHash(a)).not.toBe(evidenceHash(b));
  });
});

describe('inferSlug for controllers synced from the registry log', () => {
  it('recovers the slug with or without a trailing "(fiktif)" note', () => {
    expect(inferSlug(controllerId('rsud-contoh'), 'RSUD Contoh (fiktif)')).toBe('rsud-contoh');
    expect(inferSlug(controllerId('disdukcapil-kota-contoh'), 'Disdukcapil Kota Contoh (fiktif)')).toBe('disdukcapil-kota-contoh');
    expect(inferSlug(controllerId('demo-one'), 'Demo One')).toBe('demo-one');
  });

  it('falls back to the id itself when the name does not derive the id', () => {
    const other: Hex = controllerId('agency-x');
    expect(inferSlug(other, 'Some Agency')).toBe(other);
  });
});
