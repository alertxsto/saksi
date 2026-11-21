import { describe, expect, test } from 'vitest';
import { draftPrompt, explainPrompt } from '../lib/server/prompts';

describe('draft prompt', () => {
  test('answers in the narrative language (Indonesian in, Indonesian out)', () => {
    expect(draftPrompt).toMatch(/same language as the narrative/);
    expect(draftPrompt).toMatch(/Indonesian narrative gets Indonesian values/);
    expect(draftPrompt).not.toMatch(/Draft an English/);
  });
  test('keeps the draft schema: English keys and the same fields', () => {
    expect(draftPrompt).toMatch(/keys exactly as named here, in English/);
    for (const field of ['dataAffected', 'whenAndHow', 'actionsTaken', 'contact', 'detectedAtGuess']) expect(draftPrompt).toContain(field);
    expect(draftPrompt).toMatch(/Do not invent facts/);
    expect(draftPrompt).toMatch(/untrusted data/);
  });
  test('the explain prompt answers in the screen language and stays on the receipt', () => {
    expect(explainPrompt).toMatch(/language named by the input field "language"/);
    expect(explainPrompt).toMatch(/never give code/);
  });
});
