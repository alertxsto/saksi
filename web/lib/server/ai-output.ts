// Pure model-call settings and output parsing shared by the AI routes and scripts/ai-eval.ts.
// Keep this module free of server-only, database and chain imports so the eval can load it outside Next.js.
import { z } from 'zod';

export const AI_MAX_TOKENS = 700;
export const AI_TIMEOUT_MS = 8_000;

// Models often wrap JSON in ``` fences or add a sentence around it; take the outermost object.
export function extractJson(content: string): unknown {
  const start = content.indexOf('{'), end = content.lastIndexOf('}');
  if (start === -1 || end <= start) throw new SyntaxError('No JSON object in model output.');
  return JSON.parse(content.slice(start, end + 1));
}
export const draftResult = z.strictObject({ dataAffected: z.string().max(1000), whenAndHow: z.string().max(2000),
  actionsTaken: z.string().max(2000), contact: z.string().max(500), detectedAtGuess: z.string().max(100).optional() });
// The notice accepts exactly the four Art. 46 parts (prepareBreachInput is strict), so the optional
// detection-time hint travels beside them, never inside them.
export function splitDraft({ detectedAtGuess, ...fields }: z.output<typeof draftResult>) {
  const hint = detectedAtGuess?.trim();
  return { fields, ...(hint ? { detectedAtGuess: hint } : {}) };
}
