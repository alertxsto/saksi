// Turns an /api/status response body into one tab-separated line per check:
//   PASS|WARN|FAIL <TAB> check <TAB> detail
// Exits 0 when the body has the expected shape, 2 when it does not.
//   node status-report.mjs status.json    (preflight.sh, host Node)
//   node status-report.mjs < status.json  (deploy.sh runs it inside the saksi-web image)
import { readFileSync } from 'node:fs';

let status;
try {
  status = JSON.parse(readFileSync(process.argv[2] ?? 0, 'utf8'));
} catch {
  console.log('FAIL\tstatus\tresponse is not JSON');
  process.exit(2);
}

const shapeOk = status && Array.isArray(status.rpc) && typeof status.db === 'object' && status.db !== null
  && typeof status.ai === 'object' && status.ai !== null && typeof status.contracts === 'object' && status.contracts !== null;
if (!shapeOk) {
  console.log('FAIL\tstatus\tresponse lacks rpc/db/ai/contracts');
  process.exit(2);
}

const line = (level, check, detail) => console.log([level, check, detail].join('\t'));
const ms = (probe) => (typeof probe.ms === 'number' ? `${probe.ms} ms` : 'n/a');

let rpcUp = 0;
for (const node of status.rpc) {
  if (node.ok) {
    rpcUp += 1;
    line('PASS', `rpc.${node.name}`, `Sepolia block ${node.block} (${ms(node)})`);
  } else {
    line('WARN', `rpc.${node.name}`, `unreachable or not configured (${ms(node)})`);
  }
}
line(rpcUp > 0 ? 'PASS' : 'FAIL', 'rpc', `${rpcUp}/${status.rpc.length} Sepolia RPC endpoints answering`);
line(status.db.ok ? 'PASS' : 'FAIL', 'db', status.db.ok ? `query ok (${ms(status.db)})` : `query failed (${ms(status.db)})`);
line(status.ai.ok ? 'PASS' : 'FAIL', 'ai', status.ai.ok
  ? `model ${status.ai.model} answered (${ms(status.ai)})`
  : `model ${status.ai.model ?? '(not configured)'} did not answer (${ms(status.ai)})`);

const names = ['registry', 'journal', 'breach'];
const missing = names.filter((name) => !status.contracts[name]);
line(missing.length === 0 ? 'PASS' : 'FAIL', 'contracts', missing.length === 0
  ? names.map((name) => `${name}=${status.contracts[name]}`).join(' ')
  : `missing address: ${missing.join(', ')}`);
