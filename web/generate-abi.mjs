import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const contracts = fileURLToPath(new URL('../contracts/', import.meta.url));
const entries = [['registryAbi', 'ControllerRegistry'], ['accessAbi', 'AccessJournal'], ['breachAbi', 'BreachReport']];
const declarations = entries.map(([name, contract]) => {
  const abi = JSON.parse(execFileSync('forge', ['inspect', '--root', contracts, contract, 'abi', '--json'], { encoding: 'utf8' }));
  return `export const ${name} = ${JSON.stringify(abi, null, 2)} as const;`;
});
writeFileSync(new URL('./lib/shared/abi.ts', import.meta.url), `// Generated from the Solidity contracts by generate-abi.mjs.\n\n${declarations.join('\n\n')}\n`);
