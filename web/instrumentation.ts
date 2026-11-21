// Runs once when the Next.js server starts. A missing or malformed setting otherwise only shows up
// later as a 503 on the first request that needs it.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { configProblems } = await import('./lib/server/config');
  const problems = configProblems();
  if (problems.length) console.error(`[config] Missing or invalid environment variables: ${problems.join(', ')}`);
}
