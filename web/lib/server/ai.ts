import 'server-only';
import OpenAI from 'openai';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import { aiRuns } from '../../db/schema';
import { evidenceHash } from '../shared/commit';
import { EVENT_TYPES, LEGAL_BASES, type AiMeta } from '../shared/types';
import { verifyReceipt } from '../shared/verify';
import { hexToString } from 'viem';
import { loadCitizenRows, readOpening } from './access';
import { citizenId } from './citizen';
import { hash } from './chain';
import { missing } from './http';
import { controller } from './registry';
import { draftPrompt, explainPrompt } from './prompts';

const explainResult = z.strictObject({ text: z.string().trim().min(1).max(1500)
  .refine((text) => text.split(/\s+/u).length <= 80) });
const draftResult = z.strictObject({ dataAffected: z.string().max(1000), whenAndHow: z.string().max(2000),
  actionsTaken: z.string().max(2000), contact: z.string().max(500), detectedAtGuess: z.string().max(100).optional() });
export const explainInput = z.strictObject({ eventId: z.uuid(), verifyResult: z.object({ status: z.enum(['MATCH', 'MISMATCH', 'NOT_FOUND']) }).passthrough() });
export const draftInput = z.strictObject({ controllerId: hash, narrative: z.string().trim().min(1).max(6000) });
export const aiConfig = () => {
  const { AI_BASE_URL: baseURL, AI_API_KEY: apiKey, AI_MODEL: model } = process.env;
  return baseURL && apiKey && model ? { baseURL, apiKey, model } : undefined;
};
const provider = 'sponsor';

async function generate<T>(feature: 'explain' | 'draft', prompt: string, input: object, schema: z.ZodType<T>, template: T) {
  const started = performance.now();
  const promptVersion = evidenceHash(prompt);
  const inputHash = evidenceHash({ promptVersion, input });
  const config = aiConfig();
  const client = config && new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey, maxRetries: 0, timeout: 8_000 });
  async function save(value: T, meta: Omit<AiMeta, 'latencyMs'>) {
    const ai = { ...meta, latencyMs: Math.round(performance.now() - started) };
    const [row] = await db().insert(aiRuns).values({ feature, ...ai, promptVersion, inputHash,
      outputJson: value, outputHash: evidenceHash(value) }).returning({ id: aiRuns.id });
    return { value, ai, aiRunId: row.id };
  }
  const models = config ? [...new Set([config.model, process.env.AI_FALLBACK_MODEL || (feature === 'draft' ? config.model : '')].filter(Boolean))] : [];
  const attempts = feature === 'draft' && models.length === 1 ? [models[0], models[0]] : models;
  for (const [index, model] of attempts.entries()) {
    if (!client) break;
    let parsed: z.ZodSafeParseResult<T> | undefined;
    try {
      const response = await client.chat.completions.create({ model, max_tokens: 700,
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: JSON.stringify(input) }] });
      parsed = schema.safeParse(JSON.parse(response.choices[0]?.message.content ?? ''));
    } catch { continue; }
    if (parsed.success) return save(parsed.data, { provider, model, fallbackLevel: index ? 'fallback' : 'primary' });
  }
  const [cached] = await db().select().from(aiRuns).where(and(eq(aiRuns.feature, feature), eq(aiRuns.inputHash, inputHash),
    inArray(aiRuns.fallbackLevel, ['primary', 'fallback']))).orderBy(desc(aiRuns.createdAt)).limit(1);
  const parsed = cached ? schema.safeParse(cached.outputJson) : undefined;
  if (cached && parsed?.success) return save(parsed.data, { provider: cached.provider, model: cached.model, fallbackLevel: 'cached' });
  return save(template, { provider: 'local', model: 'template', fallbackLevel: 'template' });
}

export async function explain({ eventId }: z.output<typeof explainInput>) {
  const id = await citizenId();
  const record = (await loadCitizenRows(id)).find(({ row }) => row.id === eventId);
  if (!record) throw missing();
  const opening = readOpening(record.row, record.controllerName);
  // Never accept the browser-supplied verdict as input to the model.
  const { status, mismatches } = await verifyReceipt(opening);
  const basis = hexToString(opening.legalBasisKey, { size: 32 });
  const allowed = { controllerName: opening.controllerName, eventType: EVENT_TYPES[opening.eventType], purposeText: opening.purposeText,
    legalBasis: Object.hasOwn(LEGAL_BASES, basis) ? LEGAL_BASES[basis as keyof typeof LEGAL_BASES] : 'Unknown', status,
    mismatches: mismatches.map(({ field }) => field) };
  const template = { text: {
    MATCH: 'This record matches the blockchain commitment. It does not prove that the access was lawful or that it actually occurred.',
    MISMATCH: 'The current record differs from the blockchain commitment. Ask the controller for an explanation or correction.',
    NOT_FOUND: 'This node did not return a verifiable receipt. Try again later; this does not mean the record was altered.',
  }[status] };
  const { value, ai } = await generate('explain', explainPrompt, allowed, explainResult, template);
  return { text: value.text, ai };
}

export async function draft({ controllerId, narrative }: z.output<typeof draftInput>) {
  await controller(controllerId);
  const { value, ai, aiRunId } = await generate('draft', draftPrompt, { controllerId, narrative }, draftResult,
    { dataAffected: '', whenAndHow: '', actionsTaken: '', contact: '' });
  return { fields: value, ai, aiRunId };
}
