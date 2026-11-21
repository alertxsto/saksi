// Pure model-call settings and output parsing shared by the AI routes and scripts/ai-eval.ts.
// Keep this module free of server-only, database and chain imports so the eval can load it outside Next.js.
import { z } from 'zod';

// Full strength: high reasoning and no output cap (the model decides how long to think and write). The guardrails
// live in the prompts and the schemas, not in a starved token budget.
export const AI_REASONING_EFFORT = 'high' as const;
export const AI_TIMEOUT_MS = 40_000;
// One request may take AI_TIMEOUT_MS; all attempts together never take longer than this, so a screen never hangs.
export const AI_TOTAL_MS = 50_000;

// Models often wrap JSON in ``` fences or add a sentence around it; take the outermost object.
export function extractJson(content: string): unknown {
  const start = content.indexOf('{'), end = content.lastIndexOf('}');
  if (start === -1 || end <= start) throw new SyntaxError('No JSON object in model output.');
  return JSON.parse(content.slice(start, end + 1));
}
export const draftResult = z.strictObject({ dataAffected: z.string().max(1000), whenAndHow: z.string().max(2000),
  actionsTaken: z.string().max(2000), contact: z.string().max(500), detectedAtGuess: z.string().max(100).optional(),
  // The model sets this when the input is not a personal-data incident (a coding request, an unrelated question).
  outOfScope: z.boolean().optional() });
// The notice accepts exactly the four Art. 46 parts (prepareBreachInput is strict), so the optional
// detection-time hint travels beside them, never inside them.
export function splitDraft({ detectedAtGuess, outOfScope, ...fields }: z.output<typeof draftResult>): {
  fields: typeof fields; detectedAtGuess?: string; outOfScope?: true } {
  const hint = detectedAtGuess?.trim();
  if (outOfScope) return { fields: { dataAffected: '', whenAndHow: '', actionsTaken: '', contact: '' }, outOfScope: true as const };
  return { fields, ...(hint ? { detectedAtGuess: hint } : {}) };
}
