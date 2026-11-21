import { describe, expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { dueChecks } from '../lib/server/citizen';

const start = Date.UTC(2026, 10, 21, 3, 0, 0);
const row = (id: string, minutesAgo: number, status = 'submitted') => ({ id, status, createdAt: new Date(start - minutesAgo * 60_000) });

describe('citizen receipts poll re-checks submitted rows sparingly', () => {
  test('checks at most the 3 newest due submitted rows per request', () => {
    const rows = [row('a', 5), row('b', 1), row('c', 3), row('d', 2), row('e', 0, 'anchored'), row('f', 0, 'pending')];
    expect(dueChecks(rows, new Map(), start).map(({ id }) => id)).toEqual(['b', 'd', 'c']);
  });

  test('backs off per row from 3 s to a 60 s ceiling', () => {
    const state = new Map();
    const rows = [row('a', 1)];
    let now = start;
    const gaps: number[] = [];
    for (let i = 0; i < 8; i++) {
      expect(dueChecks(rows, state, now)).toHaveLength(1);
      // Not due again until the backoff has passed.
      expect(dueChecks(rows, state, now + 1)).toHaveLength(0);
      const gap = state.get('a').due - now;
      gaps.push(gap);
      now += gap;
    }
    expect(gaps).toEqual([3_000, 6_000, 12_000, 24_000, 48_000, 60_000, 60_000, 60_000]);
  });

  test('an older row gets its turn while newer rows back off', () => {
    const state = new Map();
    const rows = [row('a', 1), row('b', 2), row('c', 3), row('d', 4)];
    expect(dueChecks(rows, state, start).map(({ id }) => id)).toEqual(['a', 'b', 'c']);
    expect(dueChecks(rows, state, start + 1).map(({ id }) => id)).toEqual(['d']);
  });

  test('stops re-checking rows older than 15 minutes and forgets their state', () => {
    const state = new Map();
    expect(dueChecks([row('old', 16)], state, start)).toEqual([]);
    expect(dueChecks([row('a', 14)], state, start)).toHaveLength(1);
    expect(state.has('a')).toBe(true);
    expect(dueChecks([row('a', 14)], state, start + 2 * 60_000)).toEqual([]);
    expect(state.has('a')).toBe(false);
  });
});
