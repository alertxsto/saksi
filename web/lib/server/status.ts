import 'server-only';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { db } from '../../db/client';
import { aiConfig } from './ai';
import { addresses } from './chain';
import { configProblems } from './config';
async function probe<T extends object>(work: () => Promise<T>) {
  const start = performance.now();
  try { return { ...await work(), ok: true, ms: Math.round(performance.now() - start) }; }
  catch { return { ok: false, ms: Math.round(performance.now() - start) }; }
}
export async function serviceStatus() {
  const definitions = [['primary', process.env.NEXT_PUBLIC_RPC_PRIMARY], ['secondary', process.env.NEXT_PUBLIC_RPC_SECONDARY], ['tertiary', process.env.NEXT_PUBLIC_RPC_TERTIARY]] as const;
  const config = aiConfig();
  const [rpc, database, ai] = await Promise.all([
    Promise.all(definitions.map(async ([name, url]) => ({ name, ...await probe(async () => {
      if (!url) throw new Error('RPC not configured');
      const client = createPublicClient({ chain: sepolia, transport: http(url, { retryCount: 0, timeout: 2500 }) });
      const [chain, block] = await Promise.all([client.getChainId(), client.getBlockNumber()]);
      if (chain !== sepolia.id) throw new Error('Wrong chain');
      return { block: Number(block) };
    }) }))),
    probe(async () => { await db().execute(sql`select 1 from subjects limit 1`); return {}; }),
    probe(async () => {
      if (!config) throw new Error('AI not configured');
      const client = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey, maxRetries: 0, timeout: 3000 });
      await client.chat.completions.create({ model: config.model, stream: false, max_tokens: 3, messages: [{ role: 'user', content: 'Reply OK' }] });
      return {};
    }),
  ]);
  let contracts;
  try { contracts = addresses(); } catch { contracts = { journal: null, breach: null, registry: null }; }
  return { rpc, db: database, ai: { ...ai, model: config?.model ?? null }, contracts, configProblems: configProblems() };
}
