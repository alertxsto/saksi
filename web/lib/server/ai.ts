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
import { contradictsVerdict, EXPLAIN_TEMPLATE, withVerdict } from './explain-guard';
import { AI_MAX_TOKENS, AI_TIMEOUT_MS, draftResult, extractJson } from './ai-output';
export { draftResult, extractJson } from './ai-output';

const explainResult = z.strictObject({ text: z.string().trim().min(1).max(1500)
  .refine((text) => text.split(/\s+/u).length <= 120) });
// verifyResult is accepted for older clients but ignored: the server recomputes the verdict itself.
export const explainInput = z.strictObject({ eventId: z.uuid(), verifyResult: z.unknown().optional() });
export const draftInput = z.strictObject({ controllerId: hash, narrative: z.string().trim().min(1).max(6000) });
export const aiConfig = () => {
  const { AI_BASE_URL: baseURL, AI_API_KEY: apiKey, AI_MODEL: model } = process.env;
  return baseURL && apiKey && model ? { baseURL, apiKey, model } : undefined;
};
// Provider label shown in the UI; falls back to the AI host name (e.g. api.groq.com).
const providerName = () => {
  if (process.env.AI_PROVIDER) return process.env.AI_PROVIDER;
  try { return new URL(process.env.AI_BASE_URL ?? '').hostname || 'ai'; } catch { return 'ai'; }
};

async function generate<T>(feature: 'explain' | 'draft', prompt: string, input: object, schema: z.ZodType<T>, template: T) {
  const started = performance.now();
  const promptVersion = evidenceHash(prompt);
  const inputHash = evidenceHash({ promptVersion, input });
  const config = aiConfig();
  const client = config && new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey, maxRetries: 0, timeout: AI_TIMEOUT_MS });
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
      // stream: false is explicit because some OpenAI-compatible routers stream unless told otherwise.
      const response = await client.chat.completions.create({ model, stream: false, max_tokens: AI_MAX_TOKENS,
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: JSON.stringify(input) }] });
      parsed = schema.safeParse(extractJson(response.choices[0]?.message.content ?? ''));
    } catch { continue; }
    if (parsed.success) return save(parsed.data, { provider: providerName(), model, fallbackLevel: index ? 'fallback' : 'primary' });
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
  // purposeText is controller-written free text, so it never reaches the model (prompt-injection channel).
  const allowed = { controllerName: opening.controllerName, eventType: EVENT_TYPES[opening.eventType],
    legalBasis: Object.hasOwn(LEGAL_BASES, basis) ? LEGAL_BASES[basis as keyof typeof LEGAL_BASES] : 'Unknown', status,
    mismatches: mismatches.map(({ field }) => field) };
  // The refinement also re-checks cached outputs before they are replayed.
  const guarded = explainResult.refine(({ text }) => !contradictsVerdict(status, text));
  const { value, ai } = await generate('explain', explainPrompt, allowed, guarded, { text: EXPLAIN_TEMPLATE[status] });
  return { text: withVerdict(status, value.text), ai };
}

export async function draft({ controllerId, narrative }: z.output<typeof draftInput>) {
  await controller(controllerId);
  const { value, ai, aiRunId } = await generate('draft', draftPrompt, { controllerId, narrative }, draftResult,
    { dataAffected: '', whenAndHow: '', actionsTaken: '', contact: '' });
  return { fields: value, ai, aiRunId };
}
