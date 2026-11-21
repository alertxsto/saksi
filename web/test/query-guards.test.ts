import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
// The per-IP limits are covered in route-guards.test.ts; here they always allow.
vi.mock('../lib/server/rate-limit', () => ({ consume: async () => true }));
// A pg-proxy drizzle client records the SQL each service sends, without a database.
const queries: { sql: string; params: unknown[] }[] = [];
let answer: (sql: string) => unknown[][] = () => [];
vi.mock('../db/client', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  const schema = await import('../db/schema');
  const client = drizzle(async (sql, params) => { queries.push({ sql, params }); return { rows: answer(sql) }; }, { schema });
  return { db: () => client };
});
const registryLookup = vi.fn();
vi.mock('../lib/server/registry', () => ({ controller: (...args: unknown[]) => registryLookup(...args) }));
import { recentAccess } from '../lib/server/access';
import { controllerId as slugId } from '../lib/shared/commit';
import { GET } from '../app/api/[...path]/route';

const controllerId = `0x${'81'.repeat(32)}` as const;
beforeEach(() => { queries.length = 0; answer = () => []; registryLookup.mockReset(); });
afterEach(() => { vi.restoreAllMocks(); });

function watch(id: string) {
  const request = new Request(`http://localhost/api/watch?controllerId=${id}`);
  return GET(request, { params: Promise.resolve({ path: ['watch'] }) });
}

describe('Watch filtered by controller', () => {
  test('an unknown controllerId is a 404 before any RPC call or registry scan', async () => {
    const response = await watch(controllerId);
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('UNKNOWN_CONTROLLER');
    expect(registryLookup).not.toHaveBeenCalled();
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('from "controllers"');
  });

  test('a demo controller not stored yet is looked up in the registry once, then scanned', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registryLookup.mockResolvedValue({ id: slugId('demo-spare') });
    // No RPC is configured in tests, so reaching the chain scan surfaces as 503.
    expect((await watch(slugId('demo-spare'))).status).toBe(503);
    expect(registryLookup).toHaveBeenCalledWith(slugId('demo-spare'));
  });

  test('a stored controller goes straight to the scan', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    answer = (sql) => sql.includes('from "controllers"') ? [[controllerId]] : [];
    expect((await watch(controllerId)).status).toBe(503);
    expect(registryLookup).not.toHaveBeenCalled();
  });
});

describe('controller recent panel', () => {
  test('leaves out pending drafts', async () => {
    await expect(recentAccess(controllerId)).resolves.toEqual({ rows: [] });
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toMatch(/"access_events"\."status" <> \$\d/);
    expect(queries[0].params).toContain('pending');
    expect(queries[0].params).toContain(controllerId);
  });
});
