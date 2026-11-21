// Offline evaluation of the breach-notice drafter against synthetic narratives (scripts/ai-eval-cases.json).
// Usage (from web/):
//   AI_BASE_URL=https://provider.example/v1 AI_API_KEY=... AI_EVAL_MODELS=model-a,model-b pnpm ai:eval
// or put the three variables in .env.local and run: pnpm tsx --env-file=.env.local scripts/ai-eval.ts
// Each case gets one request per model with the production prompt, input shape, max_tokens, timeout and parser.
// Production retries a failed draft once on the same model; this harness scores the single attempt.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { AI_REASONING_EFFORT, AI_TIMEOUT_MS } from '../lib/server/ai-output';
import { draftPrompt } from '../lib/server/prompts';
import { controllerId, evidenceHash } from '../lib/shared/commit';
import { evalCaseFile, formatMarkdown, gradeOutput, summarize, type CaseRun } from './ai-eval-lib';

const { AI_BASE_URL: baseURL, AI_API_KEY: apiKey, AI_EVAL_MODELS: modelList } = process.env;
const models = [...new Set((modelList ?? '').split(',').map((model) => model.trim()).filter(Boolean))];
const missingEnv = [!baseURL && 'AI_BASE_URL', !apiKey && 'AI_API_KEY', !models.length && 'AI_EVAL_MODELS'].filter(Boolean);
if (!baseURL || !apiKey || !models.length) {
  console.error(`ai-eval: missing ${missingEnv.join(', ')}. Set AI_BASE_URL and AI_API_KEY for an OpenAI-compatible endpoint `
    + 'and AI_EVAL_MODELS as a comma-separated model list. No results were produced.');
  process.exit(2);
}

const casesUrl = new URL('./ai-eval-cases.json', import.meta.url);
const resultsUrl = new URL('./ai-eval-results.json', import.meta.url);
const { cases } = evalCaseFile.parse(JSON.parse(readFileSync(casesUrl, 'utf8')));
const client = new OpenAI({ baseURL, apiKey, maxRetries: 0, timeout: AI_TIMEOUT_MS });
// Same input shape as draft(): a controller id plus the narrative. The id is a synthetic, unregistered controller.
const evalControllerId = controllerId('ai-eval-synthetic');

const report = [];
for (const model of models) {
  const runs: (CaseRun & { output?: string })[] = [];
  for (const evalCase of cases) {
    const started = performance.now();
    let content: string | undefined, error: string | undefined;
    try {
      const response = await client.chat.completions.create({ model, stream: false, reasoning_effort: AI_REASONING_EFFORT,
        messages: [{ role: 'system', content: draftPrompt },
          { role: 'user', content: JSON.stringify({ controllerId: evalControllerId, narrative: evalCase.narrative }) }] });
      content = response.choices[0]?.message.content ?? '';
    } catch (cause) {
      error = (cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)).slice(0, 300);
    }
    const latencyMs = Math.round(performance.now() - started);
    const grade = gradeOutput(evalCase, content);
    // Keep raw text only when it failed to parse, so the JSON shows why.
    runs.push({ id: evalCase.id, latencyMs, error, ...grade, output: grade.schemaValid ? undefined : content?.slice(0, 2000) });
    console.error(`[${model}] ${evalCase.id}: ${error ? 'error' : grade.schemaValid ? 'schema-valid' : grade.validJson ? 'schema-invalid' : 'no JSON'} in ${latencyMs} ms`);
  }
  report.push({ summary: summarize(model, runs), runs });
}

const endpointHost = (() => { try { return new URL(baseURL).host; } catch { return 'invalid-url'; } })();
writeFileSync(resultsUrl, JSON.stringify({
  generatedAt: new Date().toISOString(),
  endpointHost,
  promptVersion: evidenceHash(draftPrompt),
  reasoningEffort: AI_REASONING_EFFORT,
  timeoutMs: AI_TIMEOUT_MS,
  attemptsPerCase: 1,
  caseCount: cases.length,
  models: report,
}, null, 2) + '\n');

console.log(formatMarkdown(report.map(({ summary }) => summary)));
console.log(`\nPrompt version ${evidenceHash(draftPrompt).slice(0, 10)}, ${cases.length} synthetic cases, endpoint ${endpointHost}. `
  + `Details: ${fileURLToPath(resultsUrl)}`);
