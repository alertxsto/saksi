import { expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { accessInput } from '../lib/server/access';
import { compareOpening } from '../lib/server/watch';
import type { ReceiptOpening } from '../lib/shared/types';
import type { Hex } from 'viem';

const hex = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;
const opening: ReceiptOpening = { eventId: 'synthetic', controllerId: hex(1), controllerName: 'Demo One', subjectPseudonym: hex(2),
  purposeText: 'Service', purposeSalt: hex(6), legalBasisKey: hex(4), eventType: 3, evidence: { note: 'synthetic' },
  txHash: hex(10), logIndex: 1, status: 'anchored', createdAt: '2026-01-01T00:00:00Z' };
const anchored = { controllerId: hex(1), subjectPseudonym: hex(2), legalBasisKey: hex(4), eventType: 3, timestamp: 291n,
  purposeHash: '0x25c362b1cf9caaae96629d2d20e9876c947a733904386ef688397c58dc68f94f',
  evidenceHash: '0x67e530b14f1b82dddec04e72a67b1ab1d0e813bee4df960b70a9554afad45fca' } as const;

test('Watch compares the current opening, not the hash previously stored in the database', () => {
  expect(compareOpening(opening, anchored)).toBeUndefined();
  expect(compareOpening({ ...opening, eventType: 0 }, anchored)).toEqual({ field: 'eventType', dbValue: 'READ', chainValue: 'SHARE_THIRD_PARTY' });
  expect(compareOpening({ ...opening, evidence: { note: 'edited' } }, anchored)?.field).toBe('evidence');
});

test('access preparation accepts encoded legal codes, not display labels', () => {
  const valid = { controllerId: hex(1), subjectCode: 'ABCD23', purposeText: 'Service', legalBasisKey: 'PDP-20-2-a', eventType: 3 };
  expect(accessInput.parse(valid).legalBasisKey).toBe('PDP-20-2-a');
  expect(accessInput.safeParse({ ...valid, legalBasisKey: 'Consent' }).success).toBe(false);
});

test('extracts model JSON wrapped in code fences or prose', async () => {
  const { extractJson } = await import('../lib/server/ai');
  expect(extractJson('```json\n{"text":"ok"}\n```')).toEqual({ text: 'ok' });
  expect(extractJson('Here you go: {"a":{"b":1}} thanks')).toEqual({ a: { b: 1 } });
  expect(() => extractJson('no json here')).toThrow();
});
