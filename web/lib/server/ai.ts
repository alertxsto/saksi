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
import { contradictsVerdict, templateFor, withVerdict } from './explain-guard';
import { AI_REASONING_EFFORT, AI_TIMEOUT_MS, draftResult, extractJson, splitDraft } from './ai-output';
export { draftResult, extractJson } from './ai-output';

const explainResult = z.strictObject({ text: z.string().trim().min(1).max(1500)
  .refine((text) => text.split(/\s+/u).length <= 120) });
// verifyResult is accepted for older clients but ignored: the server recomputes the verdict itself.
// lang: the citizen's screen language; the explanation (and its fixed verdict sentence) comes back in it.
export const explainInput = z.strictObject({ eventId: z.uuid(), verifyResult: z.unknown().optional(), lang: z.enum(['en', 'id']).optional() });
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

/** Live text for a streamed call: `reset` when a retry starts over, `delta` for each piece of model output. */
type Stream = { delta: (text: string) => void; reset: () => void };

async function generate<T>(feature: 'explain' | 'draft', prompt: string, input: object, schema: z.ZodType<T>, template: T, stream?: Stream) {
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
      const params = { model, reasoning_effort: AI_REASONING_EFFORT,
        messages: [{ role: 'system' as const, content: prompt }, { role: 'user' as const, content: JSON.stringify(input) }] };
      let content = '';
      if (stream) {
        if (index) stream.reset();
        for await (const part of await client.chat.completions.create({ ...params, stream: true })) {
          const piece = part.choices[0]?.delta?.content;
          if (piece) { content += piece; stream.delta(piece); }
        }
      } else {
        // stream: false is explicit because some OpenAI-compatible routers stream unless told otherwise.
        content = (await client.chat.completions.create({ ...params, stream: false })).choices[0]?.message.content ?? '';
      }
      parsed = schema.safeParse(extractJson(content));
    } catch { continue; }
    if (parsed.success) return save(parsed.data, { provider: providerName(), model, fallbackLevel: index ? 'fallback' : 'primary' });
  }
  const [cached] = await db().select().from(aiRuns).where(and(eq(aiRuns.feature, feature), eq(aiRuns.inputHash, inputHash),
    inArray(aiRuns.fallbackLevel, ['primary', 'fallback']))).orderBy(desc(aiRuns.createdAt)).limit(1);
  const parsed = cached ? schema.safeParse(cached.outputJson) : undefined;
  if (cached && parsed?.success) return save(parsed.data, { provider: cached.provider, model: cached.model, fallbackLevel: 'cached' });
  return save(template, { provider: 'local', model: 'template', fallbackLevel: 'template' });
}

export async function explain({ eventId, lang = 'en' }: z.output<typeof explainInput>) {
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
    mismatches: mismatches.map(({ field }) => field), language: lang === 'id' ? 'Indonesian' : 'English' };
  // The refinement also re-checks cached outputs before they are replayed.
  const guarded = explainResult.refine(({ text }) => !contradictsVerdict(status, text));
  const { value, ai } = await generate('explain', explainPrompt, allowed, guarded, { text: templateFor(lang)[status] });
  return { text: withVerdict(status, value.text, lang), ai };
}

const EMPTY_DRAFT = { dataAffected: '', whenAndHow: '', actionsTaken: '', contact: '' };

export async function draft({ controllerId, narrative }: z.output<typeof draftInput>) {
  await controller(controllerId);
  const { value, ai, aiRunId } = await generate('draft', draftPrompt, { controllerId, narrative }, draftResult, EMPTY_DRAFT);
  return { ...splitDraft(value), ai, aiRunId };
}

/**
 * Same draft, streamed as server-sent events so the four parts fill in while the model writes:
 * `delta` (raw model text), `reset` (a retry starts over), then `done` (the validated result, as POST draft returns it)
 * or `error`. The controller is checked before the stream opens, so an unknown controller still gets a plain 404.
 */
export async function draftStream({ controllerId, narrative }: z.output<typeof draftInput>): Promise<ReadableStream<Uint8Array>> {
  await controller(controllerId);
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(out) {
      const send = (event: object) => out.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        const { value, ai, aiRunId } = await generate('draft', draftPrompt, { controllerId, narrative }, draftResult, EMPTY_DRAFT,
          { delta: (text) => send({ type: 'delta', text }), reset: () => send({ type: 'reset' }) });
        send({ type: 'done', ...splitDraft(value), ai, aiRunId });
      } catch (error) {
        console.error('[api] draft stream', error instanceof Error ? error.message : error);
        send({ type: 'error', message: 'Saksi is temporarily unavailable. Try again.' });
      }
      out.close();
    },
  });
}
