import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
// Plain Postgres over TCP: works with the Postgres container next to the app (deploy/compose.yaml)
// and with hosted Postgres such as Neon (use its direct connection string with sslmode=require).
function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  return drizzle(postgres(url, { max: 5, idle_timeout: 30, connect_timeout: 10 }), { schema });
}
let client: ReturnType<typeof connect> | undefined;
export const db = () => client ??= connect();
