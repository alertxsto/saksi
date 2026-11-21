import 'server-only';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  return drizzle(url, { schema });
}
let client: ReturnType<typeof connect> | undefined;
export const db = () => client ??= connect();
