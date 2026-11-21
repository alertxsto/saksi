import { loadEnvFile } from 'node:process';
import { defineConfig } from 'drizzle-kit';
try { loadEnvFile('.env.local'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
export default defineConfig({ dialect: 'postgresql', schema: './db/schema.ts', dbCredentials: { url: process.env.DATABASE_URL } });
