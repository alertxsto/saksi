import { expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { dedupeWords } from '../lib/server/citizen';

test('synthetic names never repeat a word', () => {
  expect(dedupeWords('Iriana Iriana Ananda')).toBe('Iriana Ananda');
  expect(dedupeWords('Budi Santoso')).toBe('Budi Santoso');
});
