import { describe, expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { draftResult, splitDraft } from '../lib/server/ai-output';
import { breachWindow, prepareBreachInput, regulatorList, view } from '../lib/server/breach';
import { partialDraft, toBreachDetail, toBreachDraft, type BreachDetailWire } from '../lib/data';
import type { BreachRow } from '../lib/shared/types';

const H = 3600;
const controllerId = `0x${'9d'.repeat(32)}` as const;
const parts = { dataAffected: 'Names, NIK and phone numbers of 18,400 customers', whenAndHow: 'A public storage bucket',
  actionsTaken: 'Bucket made private, credentials rotated', contact: 'dpo@bank.example' };

describe('AI draft to prepare', () => {
  // Captured from the live draft endpoint: the model adds detectedAtGuess when the narrative states a time.
  const model = draftResult.parse({ ...parts, detectedAtGuess: ' 20 November 2026 at 09:40 WIB ' });

  test('the raw model draft is rejected by the strict prepare schema', () => {
    const input = { controllerId, fields: model, detectedAt: 1_795_000_000, affectedCount: 18_400 };
    expect(prepareBreachInput.safeParse(input).success).toBe(false);
  });

  test('the draft route returns only the four Art. 46 parts and the hint beside them', () => {
    const { fields, detectedAtGuess } = splitDraft(model);
    expect(fields).toEqual(parts);
    expect(detectedAtGuess).toBe('20 November 2026 at 09:40 WIB');
    expect(prepareBreachInput.safeParse({ controllerId, fields, detectedAt: 1_795_000_000, affectedCount: 18_400 }).success).toBe(true);
    expect(splitDraft(draftResult.parse({ ...parts, detectedAtGuess: '  ' }))).toEqual({ fields: parts });
  });

  test('the client keeps only the four parts even if an older server sends extra keys', () => {
    const wire = { fields: { ...parts, detectedAtGuess: 'yesterday' }, aiRunId: '178da0b2-0819-4152-b89e-55729c3b5125',
      ai: { provider: '9Router', model: 'pythia', fallbackLevel: 'primary' as const, latencyMs: 5153 } };
    const draft = toBreachDraft(wire);
    expect(draft.fields).toEqual(parts);
    expect(prepareBreachInput.safeParse({ controllerId, fields: draft.fields, detectedAt: 1, affectedCount: 1, aiRunId: draft.aiRunId }).success).toBe(true);
  });
});

describe('72-hour window', () => {
  test('matches BreachReport.anchor(): the deadline second is still on time', () => {
    const detectedAt = 1_794_977_808;
    expect(breachWindow(detectedAt, detectedAt + 72 * H)).toEqual({ deadline: detectedAt + 72 * H, mode: 'on_time', hoursLeft: 0 });
    expect(breachWindow(detectedAt, detectedAt + 72 * H + 1).mode).toBe('late');
    expect(breachWindow(detectedAt, detectedAt + 6 * H)).toMatchObject({ mode: 'on_time', hoursLeft: 66 });
    expect(breachWindow(detectedAt, detectedAt + 80 * H)).toMatchObject({ mode: 'late', hoursLeft: -8 });
  });
});

type Stored = Parameters<typeof view>[0];
const stored = (over: Partial<Stored>): Stored => ({
  id: '768e5f83-f7b8-4aa9-a468-4d16a6f2f03b', controllerId, reportJsonEnc: '', reportIv: '', reportHash: `0x${'11'.repeat(32)}`,
  affectedCountEnc: '', countSaltEnc: '', affectedCountHash: `0x${'22'.repeat(32)}`, detectedAt: 1_795_244_184, mode: 'on_time',
  status: 'anchored', txHash: `0x${'D0'.repeat(32)}`, logIndex: 0, anchoredAt: 1_795_265_820, lateBySec: 0, aiRunId: null,
  createdAt: new Date('2026-11-21T12:56:00Z'), ...over,
});

describe('regulator view', () => {
  test('hours used and lateness come from the anchored event times', () => {
    // Live late notice: detected 80 h before anchoring, so 8 h (28,824 s) past the deadline.
    const late = view(stored({ mode: 'late', detectedAt: 1_794_977_808, anchoredAt: 1_795_265_832, lateBySec: 28_824 }), 'Demo Spare');
    expect(late).toMatchObject({ mode: 'late', lateBySec: 28_824, status: 'anchored' });
    expect(late.hoursUsed).toBeCloseTo(80.0067, 3);
    expect(late.anchoredAt! - (late.detectedAt + 72 * H)).toBe(late.lateBySec);
    const onTime = view(stored({}), 'Demo Spare');
    expect(onTime).toMatchObject({ mode: 'on_time', lateBySec: 0, txHash: `0x${'d0'.repeat(32)}` });
    expect(onTime.hoursUsed).toBeCloseTo(6.01, 2);
  });

  test('lists and counts sealed notices only', () => {
    const rows: BreachRow[] = [
      view(stored({ id: 'a', mode: 'late', anchoredAt: 1_795_244_184 + 80 * H, lateBySec: 8 * H }), 'Demo Spare'),
      view(stored({ id: 'b' }), 'Demo Spare'),
      // A prepared draft whose signature was rejected: never on chain, must not read as "on time · 0 h".
      view(stored({ id: 'c', status: 'pending', txHash: null, logIndex: null, anchoredAt: null, lateBySec: null }), 'Demo Spare'),
      view(stored({ id: 'd', status: 'failed', anchoredAt: null, lateBySec: null }), 'Demo Spare'),
      view(stored({ id: 'e', status: 'submitted', anchoredAt: null, lateBySec: null }), 'Demo Spare'),
    ];
    const { rows: listed, stats } = regulatorList(rows);
    expect(listed.map((row) => row.id)).toEqual(['a', 'b']);
    expect(stats).toEqual({ total: 2, onTime: 1, late: 1 });
  });

  test('the detail screen shows the notice hash the server returns', () => {
    const row = view(stored({}), 'Demo Spare');
    const wire: BreachDetailWire = { ...row, pasal46: parts, ai: null, reportHash: `0x${'11'.repeat(32)}`, discoveryAt: row.detectedAt, deadline: row.detectedAt + 72 * H };
    expect(toBreachDetail(wire, null).reportHash).toBe(`0x${'11'.repeat(32)}`);
    expect(toBreachDetail({ ...wire, reportHash: undefined }, null).reportHash).toBeNull();
  });
});

describe('AI draft guardrail and streaming', () => {
  test('an out-of-scope request returns four empty parts and the flag, never the model text', () => {
    const off = draftResult.parse({ dataAffected: 'print("hi")', whenAndHow: '', actionsTaken: '', contact: '', outOfScope: true });
    expect(splitDraft(off)).toEqual({ fields: { dataAffected: '', whenAndHow: '', actionsTaken: '', contact: '' }, outOfScope: true });
  });

  test('partial JSON from the stream fills the parts written so far', () => {
    expect(partialDraft('{"dataAffected":"Nama, NIK')).toEqual({ dataAffected: 'Nama, NIK' });
    expect(partialDraft('{"dataAffected":"A \\"b\\"","whenAndHow":"Kemarin\\n jam')).toEqual({ dataAffected: 'A "b"', whenAndHow: 'Kemarin\n jam' });
    expect(partialDraft('{"dataAffected":"x\\')).toEqual({ dataAffected: 'x' });
    expect(partialDraft('```json\n{"contact":"dpo@x.example"}')).toEqual({ contact: 'dpo@x.example' });
  });
});
