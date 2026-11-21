import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  detectedAtCorrect, evalCaseFile, extractDates, extractTimes, formatMarkdown, gradeOutput, keywordRecall, matchesKeyword,
  percentile, summarize, type CaseRun, type EvalCase,
} from '../scripts/ai-eval-lib';

const evalCase: EvalCase = {
  id: 'synthetic', kind: 'test', language: 'en', narrative: 'Synthetic narrative.',
  expected: { dataAffected: ['name', 'email'], whenAndHow: ['bucket|storage'], actionsTaken: ['rotat'], contact: ['dpo@demo.example'] },
  detectedAt: { date: '2026-03-03', time: '09:15' },
};
const answer = (fields: Record<string, string>) => JSON.stringify({
  dataAffected: '', whenAndHow: '', actionsTaken: '', contact: '', ...fields });

describe('keyword matching', () => {
  test('is case- and accent-insensitive and accepts alternatives', () => {
    expect(matchesKeyword('Customer E-MAIL addresses', 'email|e-mail')).toBe(true);
    expect(matchesKeyword('Nomor teléfono', 'telefono')).toBe(true);
    expect(matchesKeyword('Phone numbers', 'address|alamat')).toBe(false);
    expect(matchesKeyword('anything', ' | ')).toBe(false);
  });
  test('recall reports hits, total and the missed keywords', () => {
    expect(keywordRecall('Names and phone numbers', ['name', 'phone|telepon', 'birth'])).toEqual({ hits: 2, total: 3, missed: ['birth'] });
  });
});

describe('date and time extraction', () => {
  test('reads ISO, English, Indonesian and numeric dates', () => {
    expect(extractDates('2026-03-03T09:15:00+07:00')).toEqual(['2026-03-03']);
    expect(extractDates('3 Maret 2026 pukul 09.15 WIB')).toEqual(['2026-03-03']);
    expect(extractDates('March 3rd, 2026 at 9:15 am')).toEqual(['2026-03-03']);
    expect(extractDates('Sat 6 Jun. 2026')).toEqual(['2026-06-06']);
    expect(extractDates('14/03/2026')).toEqual(['2026-03-14']);
    expect(extractDates('04/05/2026').sort()).toEqual(['2026-04-05', '2026-05-04']);
    expect(extractDates('sometime last week')).toEqual([]);
  });
  test('reads 24-hour and am/pm times without mistaking dates or UTC offsets for times', () => {
    expect(extractTimes('3 Maret 2026 pukul 09.15 WIB')).toEqual(['09:15']);
    expect(extractTimes('2026-04-11T14:40:00+07:00')).toEqual(['14:40']);
    expect(extractTimes('2:40 p.m. local time')).toEqual(['14:40']);
    expect(extractTimes('12 am')).toEqual(['00:00']);
    expect(extractTimes('on 14.03.2026')).toEqual([]);
    expect(extractTimes('at 25:99')).toEqual([]);
  });
});

describe('detectedAtGuess scoring', () => {
  test('requires the stated date and time', () => {
    expect(detectedAtCorrect('2026-03-03 09:15 WIB', { date: '2026-03-03', time: '09:15' })).toBe(true);
    expect(detectedAtCorrect('3 March 2026, 9:15 am', { date: '2026-03-03', time: '09:15' })).toBe(true);
    expect(detectedAtCorrect('2026-03-03 10:15', { date: '2026-03-03', time: '09:15' })).toBe(false);
    expect(detectedAtCorrect('09:15 WIB', { date: '2026-03-03', time: '09:15' })).toBe(false);
    expect(detectedAtCorrect(undefined, { date: '2026-03-03' })).toBe(false);
    expect(detectedAtCorrect('25 August 2026', { date: '2026-08-25' })).toBe(true);
  });
  test('rewards leaving the guess empty when the narrative gives no time', () => {
    expect(detectedAtCorrect(undefined, null)).toBe(true);
    expect(detectedAtCorrect('  ', null)).toBe(true);
    expect(detectedAtCorrect('2026-07-01', null)).toBe(false);
  });
});

describe('gradeOutput', () => {
  test('parses fenced output like production and scores each field', () => {
    const grade = gradeOutput(evalCase, '```json\n' + answer({ dataAffected: 'Names only', whenAndHow: 'A public storage bucket',
      actionsTaken: 'Keys rotated', contact: 'DPO@demo.example', detectedAtGuess: '2026-03-03 09:15' }) + '\n```');
    expect(grade).toMatchObject({ validJson: true, schemaValid: true, detectedAtCorrect: true });
    expect(grade.recall.dataAffected).toEqual({ hits: 1, total: 2, missed: ['email'] });
    expect([grade.recall.whenAndHow.hits, grade.recall.actionsTaken.hits, grade.recall.contact.hits]).toEqual([1, 1, 1]);
  });
  test('valid JSON that breaks the strict schema scores zero', () => {
    const grade = gradeOutput(evalCase, answer({ dataAffected: 'name email', extra: 'not allowed' }));
    expect(grade).toMatchObject({ validJson: true, schemaValid: false, detectedAtCorrect: false });
    expect(grade.recall.dataAffected.hits).toBe(0);
  });
  test('non-JSON and failed requests score zero', () => {
    expect(gradeOutput(evalCase, 'I cannot help with that.')).toMatchObject({ validJson: false, schemaValid: false });
    expect(gradeOutput(evalCase, undefined)).toMatchObject({ validJson: false, schemaValid: false, detectedAtCorrect: false });
  });
});

describe('aggregation', () => {
  test('percentile uses nearest rank', () => {
    expect(percentile([40, 10, 30, 20], 50)).toBe(20);
    expect(percentile([40, 10, 30, 20], 95)).toBe(40);
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 50)).toBeUndefined();
  });
  test('summarize micro-averages recall and counts failures in every denominator', () => {
    const good = gradeOutput(evalCase, answer({ dataAffected: 'name, email', whenAndHow: 'bucket', actionsTaken: 'rotated',
      contact: 'dpo@demo.example' }));
    const runs: CaseRun[] = [
      { id: 'a', latencyMs: 100, ...good },
      { id: 'b', latencyMs: 300, ...gradeOutput(evalCase, 'not json') },
      { id: 'c', latencyMs: 8000, error: 'APIConnectionTimeoutError: Request timed out.', ...gradeOutput(evalCase, undefined) },
    ];
    const summary = summarize('demo-model', runs);
    expect(summary).toMatchObject({ model: 'demo-model', cases: 3, errors: 1, latencyMs: { p50: 300, p95: 8000 } });
    expect(summary.validJsonRate).toBeCloseTo(1 / 3);
    expect(summary.schemaValidRate).toBeCloseTo(1 / 3);
    expect(summary.recall.overall).toBeCloseTo(5 / 15);
    expect(summary.recall.dataAffected).toBeCloseTo(2 / 6);
    // Case a omitted detectedAtGuess although a time was expected.
    expect(summary.detectedAtAccuracy).toBe(0);
    const table = formatMarkdown([summary]);
    expect(table).toContain('| demo-model | 3 | 1 | 33.3% | 33.3% | 33.3% | 0.0% | 300 | 8000 |');
    expect(table).toContain('| Model | dataAffected | whenAndHow | actionsTaken | contact |');
  });
});

test('the shipped case file is valid and each case can be scored from its own narrative', () => {
  const { cases } = evalCaseFile.parse(JSON.parse(readFileSync(new URL('../scripts/ai-eval-cases.json', import.meta.url), 'utf8')));
  expect(cases).toHaveLength(10);
  for (const c of cases) {
    // The expected contact must literally appear in the narrative, otherwise the case would reward invention.
    expect(c.expected.contact.some((keyword) => matchesKeyword(c.narrative, keyword)), c.id).toBe(true);
    if (c.detectedAt) expect(extractTimes(c.narrative).includes(c.detectedAt.time ?? '') || !c.detectedAt.time, c.id).toBe(true);
  }
  expect(cases.filter((c) => c.detectedAt === null).map((c) => c.id)).toEqual(['misdirected-email']);
});
