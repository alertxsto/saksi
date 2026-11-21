import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { citizenRateLimits } from '../../db/schema';

// Fixed one-minute window per key, shared by every server instance through the database.
export async function consume(key: string, perMinute: number) {
  const window = Math.floor(Date.now() / 60_000);
  const [quota] = await db().insert(citizenRateLimits).values({ key, window, count: 1 }).onConflictDoUpdate({
    target: citizenRateLimits.key, set: { window, count: sql`case when ${citizenRateLimits.window} < ${window} then 1 else ${citizenRateLimits.count} + 1 end` },
    setWhere: sql`${citizenRateLimits.window} < ${window} or ${citizenRateLimits.count} < ${perMinute}`,
  }).returning({ count: citizenRateLimits.count });
  return Boolean(quota);
}
