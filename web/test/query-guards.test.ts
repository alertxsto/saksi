import { beforeEach, describe, expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
// A pg-proxy drizzle client records the SQL each service sends, without a database.
const queries: { sql: string; params: unknown[] }[] = [];
let answer: (sql: string) => unknown[][] = () => [];
vi.mock('../db/client', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  const schema = await import('../db/schema');
  const client = drizzle(async (sql, params) => { queries.push({ sql, params }); return { rows: answer(sql) }; }, { schema });
  return { db: () => client };
});
import { recentAccess } from '../lib/server/access';

const controllerId = `0x${'81'.repeat(32)}` as const;
beforeEach(() => { queries.length = 0; answer = () => []; });

describe('controller recent panel', () => {
  test('leaves out pending drafts', async () => {
    await expect(recentAccess(controllerId)).resolves.toEqual({ rows: [] });
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toMatch(/"access_events"\."status" <> \$\d/);
    expect(queries[0].params).toContain('pending');
    expect(queries[0].params).toContain(controllerId);
  });
});
