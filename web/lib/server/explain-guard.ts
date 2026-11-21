// Deterministic guard around the AI receipt explanation. The verdict comes from the verifier, so the
// shown text always starts with a fixed verdict sentence, and model text that argues with that verdict
// (or calls the access lawful or unlawful) is rejected so the caller falls back to the template.
// False positives only cost the model's wording; the template says the same thing safely.
export type ExplainStatus = 'MATCH' | 'MISMATCH' | 'NOT_FOUND';

export const VERDICT: Record<ExplainStatus, string> = {
  MATCH: 'This record matches the blockchain commitment.',
  MISMATCH: 'The current record differs from the blockchain commitment.',
  NOT_FOUND: 'This node did not return a verifiable receipt.',
};

export const EXPLAIN_TEMPLATE: Record<ExplainStatus, string> = {
  MATCH: `${VERDICT.MATCH} It does not prove that the access was lawful or that it actually occurred.`,
  MISMATCH: `${VERDICT.MISMATCH} Ask the controller for an explanation or correction.`,
  NOT_FOUND: `${VERDICT.NOT_FOUND} Try again later; this does not mean the record was altered.`,
};

const negation = /\b(not|no|never|cannot|without|neither|nor)\b|n['’]t\b/i;
// Legal conclusions are outside what a hash comparison can show, whatever the verdict.
const legal = /\b(lawful(ly)?|unlawful(ly)?|legal(ly)?|illegal(ly)?|legitimate|illegitimate|compliant|violat\w*)\b/i;
const affirmsIntact = /\b(match(es|ed|ing)?|authentic|verified|genuine|intact|unaltered|untampered|unchanged|consistent|valid|trustworthy)\b/i;
const affirmsAltered = /\b(alter(ed|ation)?|tamper(ed|ing)?|mismatch(es|ed)?|modified|forged|fake|falsified|changed|differs?|deleted)\b/i;

// A sentence with a negation is treated as a disclaimer ("does not prove it was lawful") only for legal
// wording; verdict wording must not appear affirmatively at all for the opposite status.
export function contradictsVerdict(status: ExplainStatus, text: string): boolean {
  const sentences = text.split(/(?<=[.!?;:])\s+|\n+/u).map((sentence) => sentence.trim()).filter(Boolean);
  return sentences.some((sentence) => {
    const negated = negation.test(sentence);
    if (legal.test(sentence) && !negated) return true;
    if (status !== 'MATCH' && affirmsIntact.test(sentence) && !negated) return true;
    if (status === 'MATCH' && affirmsAltered.test(sentence) && !negated) return true;
    return false;
  });
}

// Prefix the deterministic verdict unless the text already opens with it.
export function withVerdict(status: ExplainStatus, text: string): string {
  const trimmed = text.trim();
  return trimmed.startsWith(VERDICT[status]) ? trimmed : `${VERDICT[status]} ${trimmed}`;
}
