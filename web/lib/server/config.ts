// Names of required settings that are missing or malformed. Values are never returned or logged.
// Literal process.env reads are deliberate: Next.js inlines NEXT_PUBLIC_* values at build time.
const hex32 = /^(0x)?[0-9a-f]{64}$/i;
const addressFormat = /^0x[0-9a-f]{40}$/i;
export function configProblems(env: Record<string, string | undefined> = {
  DATABASE_URL: process.env.DATABASE_URL,
  SUBJECT_KEY: process.env.SUBJECT_KEY,
  DATA_KEY: process.env.DATA_KEY,
  SESSION_SECRET: process.env.SESSION_SECRET,
  NEXT_PUBLIC_RPC_PRIMARY: process.env.NEXT_PUBLIC_RPC_PRIMARY,
  NEXT_PUBLIC_REGISTRY_ADDRESS: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS,
  NEXT_PUBLIC_JOURNAL_ADDRESS: process.env.NEXT_PUBLIC_JOURNAL_ADDRESS,
  NEXT_PUBLIC_BREACH_ADDRESS: process.env.NEXT_PUBLIC_BREACH_ADDRESS,
  NEXT_PUBLIC_DEPLOY_BLOCK: process.env.NEXT_PUBLIC_DEPLOY_BLOCK,
}): string[] {
  const rules: Record<string, (value: string) => boolean> = {
    DATABASE_URL: (value) => /^postgres(ql)?:\/\//.test(value),
    SUBJECT_KEY: (value) => hex32.test(value),
    DATA_KEY: (value) => hex32.test(value),
    SESSION_SECRET: (value) => Buffer.byteLength(value) >= 32,
    NEXT_PUBLIC_RPC_PRIMARY: (value) => /^https?:\/\//.test(value),
    NEXT_PUBLIC_REGISTRY_ADDRESS: (value) => addressFormat.test(value),
    NEXT_PUBLIC_JOURNAL_ADDRESS: (value) => addressFormat.test(value),
    NEXT_PUBLIC_BREACH_ADDRESS: (value) => addressFormat.test(value),
    NEXT_PUBLIC_DEPLOY_BLOCK: (value) => /^[0-9]+$/.test(value),
  };
  return Object.entries(rules).filter(([name, valid]) => {
    const value = env[name]?.trim();
    return !value || !valid(value);
  }).map(([name]) => name);
}
