import { readFileSync } from 'node:fs';
export const explainPrompt = readFileSync(new URL('./prompts/explain.md', import.meta.url), 'utf8');
export const anomalyPrompt = readFileSync(new URL('./prompts/anomaly.md', import.meta.url), 'utf8');
export const draftPrompt = readFileSync(new URL('./prompts/draft.md', import.meta.url), 'utf8');
