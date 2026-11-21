// Pure scoring for scripts/ai-eval.ts. No network or file access, so test/ai-eval.test.ts can cover it.
import { z } from 'zod';
import { draftResult, extractJson } from '../lib/server/ai-output';

export const DRAFT_FIELDS = ['dataAffected', 'whenAndHow', 'actionsTaken', 'contact'] as const;
export type DraftField = (typeof DRAFT_FIELDS)[number];
export type DraftFields = z.output<typeof draftResult>;

const keywords = z.array(z.string().trim().min(1)).min(1);
const expectedDetectedAt = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  time: z.string().regex(/^\d{2}:\d{2}$/u).optional(),
});
// Mirrors draftInput's narrative limit so every case is something production would accept.
const evalCase = z.strictObject({
  id: z.string().min(1),
  kind: z.string().min(1),
  language: z.enum(['id', 'en']),
  narrative: z.string().trim().min(1).max(6000),
  expected: z.strictObject({ dataAffected: keywords, whenAndHow: keywords, actionsTaken: keywords, contact: keywords }),
  detectedAt: expectedDetectedAt.nullable(),
});
export type EvalCase = z.output<typeof evalCase>;
export type ExpectedDetectedAt = z.output<typeof expectedDetectedAt>;
export const evalCaseFile = z.object({ cases: z.array(evalCase).min(1) })
  .refine(({ cases }) => new Set(cases.map(({ id }) => id)).size === cases.length, 'Case ids must be unique.');

export const normalize = (text: string) =>
  text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/gu, ' ').trim();

// A keyword is a case- and accent-insensitive substring; "a|b" accepts either alternative.
export function matchesKeyword(text: string, keyword: string): boolean {
  const haystack = normalize(text);
  return keyword.split('|').map(normalize).filter(Boolean).some((alternative) => haystack.includes(alternative));
}

export type Recall = { hits: number; total: number; missed: string[] };
export function keywordRecall(text: string, expected: readonly string[]): Recall {
  const missed = expected.filter((keyword) => !matchesKeyword(text, keyword));
  return { hits: expected.length - missed.length, total: expected.length, missed };
}

const MONTHS: Record<string, number> = {
  january: 1, januari: 1, jan: 1, february: 2, februari: 2, pebruari: 2, feb: 2, march: 3, maret: 3, mar: 3,
  april: 4, apr: 4, may: 5, mei: 5, june: 6, juni: 6, jun: 6, july: 7, juli: 7, jul: 7,
  august: 8, agustus: 8, aug: 8, agu: 8, agt: 8, september: 9, sept: 9, sep: 9, october: 10, oktober: 10, oct: 10, okt: 10,
  november: 11, nopember: 11, nov: 11, december: 12, desember: 12, dec: 12, des: 12,
};
const MONTH = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const ORDINAL = '(?:st|nd|rd|th)?';
const DATE_PATTERNS: { pattern: RegExp; read: (m: string[]) => [number, number, number][] }[] = [
  { pattern: /(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/gu, read: (m) => [[+m[1], +m[2], +m[3]]] },
  // Numeric dates are ambiguous between day-first (Indonesian) and month-first (US); accept either reading.
  { pattern: /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?!\d)/gu, read: (m) => [[+m[3], +m[2], +m[1]], [+m[3], +m[1], +m[2]]] },
  { pattern: new RegExp(`(?<!\\d)(\\d{1,2})${ORDINAL}\\s+(${MONTH})(?![a-z])\\.?,?\\s+(\\d{4})(?!\\d)`, 'gu'),
    read: (m) => [[+m[3], MONTHS[m[2]], +m[1]]] },
  { pattern: new RegExp(`(?<![a-z])(${MONTH})(?![a-z])\\.?\\s+(\\d{1,2})${ORDINAL},?\\s+(\\d{4})(?!\\d)`, 'gu'),
    read: (m) => [[+m[3], MONTHS[m[1]], +m[2]]] },
];
const pad = (value: number) => String(value).padStart(2, '0');

// Returns every calendar date written in the text as YYYY-MM-DD, plus the text with those dates blanked out.
function scanDates(text: string): { dates: string[]; rest: string } {
  let rest = normalize(text);
  const dates = new Set<string>();
  for (const { pattern, read } of DATE_PATTERNS) {
    rest = rest.replace(pattern, (...args) => {
      // replace() passes (match, ...groups, offset, input); these patterns have no named groups.
      for (const [year, month, day] of read(args.slice(0, -2) as string[])) {
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) dates.add(`${year}-${pad(month)}-${pad(day)}`);
      }
      return ' ';
    });
  }
  return { dates: [...dates], rest };
}
export const extractDates = (text: string) => scanDates(text).dates;

// Returns every clock time in the text as HH:MM (24-hour). Dates are removed first so 14.03.2026 is not read as 14:03.
export function extractTimes(text: string): string[] {
  let rest = scanDates(text).rest;
  const times = new Set<string>();
  const add = (hour: number, minute: number) => {
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) times.add(`${pad(hour)}:${pad(minute)}`);
  };
  rest = rest.replace(/(?<![\d.:])(\d{1,2})(?:[:.](\d{2}))?\s*([ap])\.?m\.?(?![a-z])/gu, (_, hour: string, minute: string | undefined, half: string) => {
    add((+hour % 12) + (half === 'p' ? 12 : 0), minute ? +minute : 0);
    return ' ';
  });
  // The leading "+" guard skips UTC offsets such as +07:00.
  for (const [, hour, minute] of rest.matchAll(/(?<![\d.:+])(\d{1,2})[:.](\d{2})(?!\d)/gu)) add(+hour, +minute);
  return [...times];
}

// Unstated detection time: the model must leave detectedAtGuess out or empty (no invented time).
// Stated: the guess must contain the expected date and, when the narrative gave one, the clock time. Time zones are not scored.
export function detectedAtCorrect(guess: string | undefined, expected: ExpectedDetectedAt | null): boolean {
  if (!expected) return !guess?.trim();
  if (!guess?.trim() || !extractDates(guess).includes(expected.date)) return false;
  return !expected.time || extractTimes(guess).includes(expected.time);
}

export type Grade = {
  validJson: boolean;
  schemaValid: boolean;
  fields?: DraftFields;
  recall: Record<DraftField, Recall>;
  detectedAtCorrect: boolean;
};
// Parses model output exactly as production does (extractJson, then draftResult). Invalid output scores zero recall.
export function gradeOutput(evalCase: EvalCase, content: string | undefined): Grade {
  let json: unknown, validJson = false;
  if (content !== undefined) {
    try { json = extractJson(content); validJson = true; } catch { validJson = false; }
  }
  const parsed = validJson ? draftResult.safeParse(json) : undefined;
  const fields = parsed?.success ? parsed.data : undefined;
  const recall = Object.fromEntries(DRAFT_FIELDS.map((field) =>
    [field, keywordRecall(fields?.[field] ?? '', evalCase.expected[field])])) as Record<DraftField, Recall>;
  return { validJson, schemaValid: Boolean(fields), fields, recall,
    detectedAtCorrect: fields ? detectedAtCorrect(fields.detectedAtGuess, evalCase.detectedAt) : false };
}

// Nearest-rank percentile; undefined for an empty sample.
export function percentile(values: readonly number[], p: number): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

export type CaseRun = Grade & { id: string; latencyMs: number; error?: string };
export type ModelSummary = {
  model: string;
  cases: number;
  errors: number;
  validJsonRate: number;
  schemaValidRate: number;
  recall: Record<DraftField | 'overall', number>;
  detectedAtAccuracy: number;
  latencyMs: { p50?: number; p95?: number };
};
const ratio = (part: number, whole: number) => (whole ? part / whole : 0);

// Recall is micro-averaged: total keyword hits over total expected keywords, across every case including failed ones.
export function summarize(model: string, runs: readonly CaseRun[]): ModelSummary {
  const sum = (pick: (run: CaseRun) => number) => runs.reduce((total, run) => total + pick(run), 0);
  const fieldRecall = (field: DraftField) => ratio(sum((run) => run.recall[field].hits), sum((run) => run.recall[field].total));
  const latencies = runs.map(({ latencyMs }) => latencyMs);
  return {
    model,
    cases: runs.length,
    errors: runs.filter(({ error }) => error !== undefined).length,
    validJsonRate: ratio(runs.filter(({ validJson }) => validJson).length, runs.length),
    schemaValidRate: ratio(runs.filter(({ schemaValid }) => schemaValid).length, runs.length),
    recall: {
      ...(Object.fromEntries(DRAFT_FIELDS.map((field) => [field, fieldRecall(field)])) as Record<DraftField, number>),
      overall: ratio(sum((run) => DRAFT_FIELDS.reduce((n, f) => n + run.recall[f].hits, 0)),
        sum((run) => DRAFT_FIELDS.reduce((n, f) => n + run.recall[f].total, 0))),
    },
    detectedAtAccuracy: ratio(runs.filter((run) => run.detectedAtCorrect).length, runs.length),
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
  };
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const ms = (value: number | undefined) => (value === undefined ? 'n/a' : `${value}`);
export function formatMarkdown(summaries: readonly ModelSummary[]): string {
  const row = (cells: string[]) => `| ${cells.join(' | ')} |`;
  const quality = [
    row(['Model', 'Cases', 'Errors', 'Valid JSON', 'Schema-valid', 'Keyword recall', 'detectedAt acc.', 'p50 ms', 'p95 ms']),
    row(['---', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:']),
    ...summaries.map((s) => row([s.model, `${s.cases}`, `${s.errors}`, pct(s.validJsonRate), pct(s.schemaValidRate),
      pct(s.recall.overall), pct(s.detectedAtAccuracy), ms(s.latencyMs.p50), ms(s.latencyMs.p95)])),
  ];
  const fields = [
    row(['Model', ...DRAFT_FIELDS]),
    row(['---', ...DRAFT_FIELDS.map(() => '---:')]),
    ...summaries.map((s) => row([s.model, ...DRAFT_FIELDS.map((field) => pct(s.recall[field]))])),
  ];
  return [...quality, '', 'Keyword recall by field:', '', ...fields].join('\n');
}
