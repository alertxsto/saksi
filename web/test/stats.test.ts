import { expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { maskCode } from '../lib/server/stats';

test('the stage feed never shows a full citizen code', () => {
  expect(maskCode('K7M2QD')).toBe('K7••••');
  expect(maskCode(null)).toBe('••••••');
});
