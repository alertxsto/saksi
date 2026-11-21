#!/usr/bin/env node
// Re-seed the regulator page with one ON-TIME and one LATE breach notice, end to end, against a live Saksi.
//
// Usage (from web/):
//   SAKSI_URL=https://saksiku.web.id node scripts/demo-breach.mjs            # both notices
//   SAKSI_URL=https://saksiku.web.id node scripts/demo-breach.mjs --only=late
//
// What it does for each notice, exactly like the controller screen:
//   1. POST /api/controller/breach/draft  -> the four UU PDP Art. 46 parts from a synthetic narrative
//   2. POST /api/controller/breach/prepare -> report + affected-count fingerprints (detectedAt is claimed)
//   3. `cast call anchor()` -> on time: accepted; late: reverts ClaimedWindowExpired(detectedAt, deadline)
//   4. `cast send anchor()` (on time) or `anchorLate()` (late) with the prepared args, without waiting
//   5. POST /api/controller/breach/submit, then /confirm until the server sees the event (status anchored)
//   6. GET /api/regulator/breaches and /api/regulator/breaches/<id>: checks mode, lateBySec, deadline, hoursUsed
// It exits non-zero when any check fails.
//
// Requirements: Node 22+, Foundry `cast`, and a Foundry keystore whose address is the registered key of the
// controller. Nothing secret is printed: cast reads the keystore password from the file.
//
// Environment (defaults in brackets):
//   SAKSI_URL           required, e.g. https://saksiku.web.id
//   SAKSI_CONTROLLER    controller slug; controllerId = keccak256("ctrl:<slug>")  [demo-spare]
//   CAST_ACCOUNT        Foundry keystore name                                    [saksi-deployer]
//   CAST_PASSWORD_FILE  keystore password file                                   [~/.foundry/saksi-deployer.pw]
//   CAST_BIN            cast executable                                          [~/.foundry/bin/cast, else cast on PATH]
//   RPC_URL             Sepolia RPC                                              [https://ethereum-sepolia-rpc.publicnode.com]
//   BREACH_ADDRESS      BreachReport contract                                    [contracts/deployments/sepolia.json]
//   ON_TIME_HOURS       how long before now the on-time breach was detected      [6]
//   LATE_HOURS          how long before now the late breach was detected (>72)   [80]

import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const WINDOW = 72 * 3600;
const env = process.env;
const fail = (message) => { console.error(`\nFAIL ${message}`); process.exit(1); };

if (!env.SAKSI_URL) fail('Set SAKSI_URL (for example SAKSI_URL=https://saksiku.web.id). See the usage at the top of this file.');
const base = new URL(env.SAKSI_URL);
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
if (only && only !== 'on_time' && only !== 'late') fail('--only must be on_time or late.');

const foundryCast = join(homedir(), '.foundry', 'bin', process.platform === 'win32' ? 'cast.exe' : 'cast');
const castBin = env.CAST_BIN || (existsSync(foundryCast) ? foundryCast : 'cast');
const account = env.CAST_ACCOUNT || 'saksi-deployer';
const passwordFile = env.CAST_PASSWORD_FILE || join(homedir(), '.foundry', 'saksi-deployer.pw');
const rpcUrl = env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const deployment = JSON.parse(readFileSync(fileURLToPath(new URL('../../contracts/deployments/sepolia.json', import.meta.url)), 'utf8'));
const breachAddress = env.BREACH_ADDRESS || deployment.contracts.BreachReport;
const slug = env.SAKSI_CONTROLLER || 'demo-spare';
const onTimeHours = Number(env.ON_TIME_HOURS || 6);
const lateHours = Number(env.LATE_HOURS || 80);
if (!(onTimeHours >= 0 && onTimeHours < 70)) fail('ON_TIME_HOURS must be between 0 and 70.');
if (!(lateHours > 73)) fail('LATE_HOURS must be above 73.');
if (!existsSync(passwordFile)) fail(`Keystore password file not found at ${passwordFile}.`);

async function cast(...args) {
  try {
    const { stdout } = await run(castBin, args, { maxBuffer: 1 << 20 });
    return { ok: true, out: stdout.trim() };
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ''}${error.stderr ?? ''}`.trim() || String(error.message) };
  }
}
async function castOk(...args) {
  const result = await cast(...args);
  if (!result.ok) fail(`cast ${args[0]} failed: ${result.out.split('\n')[0]}`);
  return result.out;
}

async function api(method, path, body, retryCodes = []) {
  const response = await fetch(new URL(`/api/${path}`, base), {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json', origin: base.origin },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) }; }
  if (!response.ok && retryCodes.includes(data?.error?.code)) return { retry: true };
  if (!response.ok) fail(`${method} /api/${path} -> HTTP ${response.status} ${JSON.stringify(data)}`);
  return data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const wib = (sec) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short' }).format(sec * 1000) + ' WIB';
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) process.exitCode = 1;
  return ok;
};

// Synthetic incidents. Times are relative to the claimed detection so the narrative and detectedAt agree.
const notices = {
  on_time: {
    hoursAgo: onTimeHours,
    affectedCount: 18_400,
    narrative: (detected) => `On ${wib(detected)} the security team of PT Bank Nusantara Sejahtera (synthetic bank) found that an object storage bucket used by the mobile banking statement export job had been made publicly readable during a configuration change. It held a CSV with full names, NIK, phone numbers, email addresses and masked account numbers of about 18,400 customers. Access logs show two unknown IP addresses downloaded the file in the 5 hours before discovery. We made the bucket private 25 minutes after discovery, rotated the export job credentials, forced a password reset and extra OTP checks for affected customers, and reported the incident to BSSN. Customers can contact our data protection officer at dpo@banknusantara.example or the 1500-888 hotline.`,
    fallback: {
      dataAffected: 'Full names, NIK, phone numbers, email addresses and masked account numbers of about 18,400 mobile banking customers.',
      whenAndHow: 'A storage bucket used by the statement export job was left publicly readable after a configuration change; two unknown IP addresses downloaded the file before the security team discovered it.',
      actionsTaken: 'The bucket was made private, export credentials were rotated, affected customers were forced to reset passwords with extra OTP checks, and BSSN was informed.',
      contact: 'Data protection officer: dpo@banknusantara.example, hotline 1500-888.',
    },
  },
  late: {
    hoursAgo: lateHours,
    affectedCount: 3_270,
    narrative: (detected) => `On ${wib(detected)} the fraud monitoring team of PT Dompet Kilat Indonesia (synthetic e-wallet fintech) saw a credential-stuffing attack against the login API of our e-wallet app. Using passwords leaked from other sites, the attacker logged in to 3,270 accounts and could see names, phone numbers, NIK, linked bank account numbers and 90 days of transaction history; 41 accounts sent unauthorised transfers. The alert was first treated as a fraud case and only escalated to the data protection officer three days later, so this notice is sent after the 72-hour window. We blocked the attacking IP ranges, forced logout and PIN reset on all affected accounts, added device binding on login, reversed the 41 transfers with partner banks, and reported to BSSN and OJK. Users can contact privacy@dompetkilat.example or WhatsApp 0811-2000-777.`,
    fallback: {
      dataAffected: 'Names, phone numbers, NIK, linked bank account numbers and 90 days of transaction history of 3,270 e-wallet users.',
      whenAndHow: 'A credential-stuffing attack on the e-wallet login API used passwords leaked elsewhere to log in to 3,270 accounts; 41 accounts sent unauthorised transfers. Escalation to the data protection officer was delayed.',
      actionsTaken: 'Attacking IP ranges were blocked, affected accounts were logged out and forced to reset their PIN, device binding was added, the 41 transfers were reversed with partner banks, and BSSN and OJK were informed.',
      contact: 'privacy@dompetkilat.example or WhatsApp 0811-2000-777.',
    },
  },
};

const PARTS = ['dataAffected', 'whenAndHow', 'actionsTaken', 'contact'];
const signature = (fn) => `${fn}(bytes32,bytes32,bytes32,uint64)`;

async function seal(kind, controllerId, signer) {
  const spec = notices[kind];
  console.log(`\n== ${kind === 'late' ? 'LATE' : 'ON-TIME'} notice ==`);
  const head = Number(await castOk('block', 'latest', '--field', 'timestamp', '--rpc-url', rpcUrl));
  const detectedAt = head - Math.round(spec.hoursAgo * 3600);
  console.log(`  detectedAt ${detectedAt} (${wib(detectedAt)}), chain time ${head}`);

  const drafted = await api('POST', 'controller/breach/draft', { controllerId, narrative: spec.narrative(detectedAt) });
  // Only the four Art. 46 parts go into the notice; the draft may also carry detectedAtGuess.
  const aiFields = Object.fromEntries(PARTS.map((key) => [key, String(drafted.fields?.[key] ?? '').trim()]));
  const usedAi = PARTS.every((key) => aiFields[key]);
  const fields = usedAi ? aiFields : spec.fallback;
  console.log(`  draft: ${drafted.ai?.provider}/${drafted.ai?.model} ${drafted.ai?.fallbackLevel}, ${drafted.ai?.latencyMs} ms${usedAi ? '' : ' -> empty parts, using built-in text'}`);
  if (drafted.fields?.detectedAtGuess) console.log(`  draft detectedAtGuess: "${drafted.fields.detectedAtGuess}" (not sent)`);

  const prepared = await api('POST', 'controller/breach/prepare', {
    controllerId, fields, detectedAt, affectedCount: spec.affectedCount, ...(usedAi && drafted.aiRunId ? { aiRunId: drafted.aiRunId } : {}),
  });
  const [argController, reportHash, countHash, argDetected] = prepared.args ?? [];
  console.log(`  prepared ${prepared.id} mode=${prepared.mode} deadline=${prepared.deadline} hoursLeft=${Number(prepared.hoursLeft).toFixed(2)}`);
  check(argController?.toLowerCase() === controllerId && Number(argDetected) === detectedAt, 'prepared args echo controllerId and detectedAt');
  check(prepared.mode === kind, `prepare predicts ${kind}`, prepared.mode);
  check(prepared.deadline === detectedAt + WINDOW, 'deadline = detectedAt + 72 h');
  const args = [argController, reportHash, countHash, String(argDetected)];

  // Ask the contract first, as the controller screen does. Nothing is sent.
  const onTimeCall = await cast('call', breachAddress, signature('anchor'), ...args, '--from', signer, '--rpc-url', rpcUrl);
  let fn = 'anchor';
  if (kind === 'on_time') {
    check(onTimeCall.ok, 'cast call anchor() is accepted', onTimeCall.ok ? '' : onTimeCall.out.split('\n')[0]);
  } else {
    const data = /data: "(0x[0-9a-fA-F]+)"/.exec(onTimeCall.out)?.[1] ?? '';
    const selector = await castOk('sig', 'ClaimedWindowExpired(uint64,uint64)');
    const word = (i) => BigInt(`0x${data.slice(10 + 64 * i, 10 + 64 * (i + 1))}`);
    const reverted = !onTimeCall.ok && data.startsWith(selector) && data.length === 10 + 128;
    check(reverted, 'cast call anchor() reverts ClaimedWindowExpired', reverted ? `detectedAt=${word(0)}, deadline=${word(1)}` : onTimeCall.out.split('\n')[0]);
    if (reverted) check(word(0) === BigInt(detectedAt) && word(1) === BigInt(detectedAt + WINDOW), 'revert carries the claimed detectedAt and the 72 h deadline');
    const lateCall = await cast('call', breachAddress, signature('anchorLate'), ...args, '--from', signer, '--rpc-url', rpcUrl);
    check(lateCall.ok, 'cast call anchorLate() is accepted', lateCall.ok ? '' : lateCall.out.split('\n')[0]);
    fn = 'anchorLate';
  }
  if (process.exitCode) fail('Stopping before sending a transaction.');

  const txHash = (await castOk('send', breachAddress, signature(fn), ...args, '--account', account, '--password-file', passwordFile,
    '--rpc-url', rpcUrl, '--async')).split('\n').pop().trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) fail(`cast send did not return a transaction hash: ${txHash}`);
  console.log(`  sent ${fn}() ${txHash}`);
  // Submit only accepts a hash Sepolia already shows (the server waits ~8 s); retry while the broadcast propagates.
  let submitted;
  for (let attempt = 1; ; attempt++) {
    submitted = await api('POST', 'controller/breach/submit', { id: prepared.id, txHash, submitToken: prepared.submitToken },
      attempt < 5 ? ['TX_NOT_VISIBLE'] : []);
    if (!submitted.retry) break;
    await sleep(2_000);
  }
  check(submitted.status === 'submitted', 'submit -> submitted');

  let confirmed;
  for (let attempt = 1; attempt <= 60; attempt++) {
    confirmed = await api('POST', 'controller/breach/confirm', { id: prepared.id });
    if (confirmed.status !== 'submitted') break;
    if (attempt === 1) process.stdout.write('  confirming');
    process.stdout.write('.');
    await sleep(3_000);
  }
  process.stdout.write('\n');
  check(confirmed.status === 'anchored', 'confirm -> anchored', confirmed.reason ?? confirmed.status);
  check(confirmed.mode === kind, `confirmed mode ${kind}`, confirmed.mode);
  const expectedLate = kind === 'late' ? confirmed.anchoredAt - detectedAt - WINDOW : 0;
  check(confirmed.lateBySec === expectedLate && (kind === 'on_time' || expectedLate > 0), 'lateBySec = anchoredAt - detectedAt - 72 h', `${confirmed.lateBySec} s`);
  return { kind, id: prepared.id, txHash, detectedAt, anchoredAt: confirmed.anchoredAt, fields, ai: usedAi };
}

async function regulator(results) {
  console.log('\n== Regulator view ==');
  const list = await api('GET', 'regulator/breaches');
  console.log(`  list: total=${list.stats.total} onTime=${list.stats.onTime} late=${list.stats.late}`);
  for (const r of results) {
    const row = list.rows.find((x) => x.id === r.id);
    const hoursUsed = (r.anchoredAt - r.detectedAt) / 3600;
    check(Boolean(row), `${r.kind}: listed`);
    if (!row) continue;
    check(row.status === 'anchored' && row.mode === r.kind, `${r.kind}: list row anchored, mode ${row.mode}`);
    check(row.txHash === r.txHash.toLowerCase(), `${r.kind}: list row txHash`);
    check(Math.abs(row.hoursUsed - hoursUsed) < 1e-9, `${r.kind}: hoursUsed`, row.hoursUsed.toFixed(2));
    const detail = await api('GET', `regulator/breaches/${r.id}`);
    check(detail.deadline === r.detectedAt + WINDOW && detail.discoveryAt === r.detectedAt, `${r.kind}: detail deadline = detectedAt + 72 h`);
    check(detail.anchoredAt === r.anchoredAt, `${r.kind}: detail anchoredAt = chain timestamp`, wib(detail.anchoredAt));
    check(kind(detail) === r.kind, `${r.kind}: anchoredAt ${detail.anchoredAt <= detail.deadline ? '<=' : '>'} deadline`);
    check(detail.lateBySec === (r.kind === 'late' ? detail.anchoredAt - detail.deadline : 0), `${r.kind}: detail lateBySec`, `${detail.lateBySec} s = ${(detail.lateBySec / 3600).toFixed(2)} h`);
    check(PARTS.every((key) => detail.pasal46?.[key] === r.fields[key]), `${r.kind}: Art. 46 parts round-trip`);
    check(r.ai ? Boolean(detail.ai?.model) : detail.ai === null, `${r.kind}: AI provenance`, detail.ai ? detail.ai.model : 'none');
  }
}
const kind = (detail) => (detail.anchoredAt <= detail.deadline ? 'on_time' : 'late');

const controllerId = (await castOk('keccak', `ctrl:${slug}`)).toLowerCase();
const signer = await castOk('wallet', 'address', '--account', account, '--password-file', passwordFile);
const authorized = await castOk('call', deployment.contracts.ControllerRegistry, 'isAuthorized(bytes32,address)(bool)', controllerId, signer, '--rpc-url', rpcUrl);
console.log(`Saksi ${base.origin} · controller ${slug} ${controllerId} · signer ${signer} · BreachReport ${breachAddress}`);
if (authorized !== 'true') fail(`${signer} is not the registered key of ${slug}.`);

const results = [];
for (const k of only ? [only] : ['on_time', 'late']) results.push(await seal(k, controllerId, signer));
await regulator(results);
console.log('');
for (const r of results) console.log(`${r.kind.padEnd(7)} ${r.id} https://sepolia.etherscan.io/tx/${r.txHash}`);
if (process.exitCode) fail('Some checks failed (see above).');
console.log('All checks passed.');
