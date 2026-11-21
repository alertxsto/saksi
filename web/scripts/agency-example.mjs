#!/usr/bin/env node
// Agency integration example: seal one access to a citizen record through Saksi, headless.
//
// The agency keeps its own database. At the moment an officer opens a citizen record, its backend:
//   1. POST /api/controller/access/prepare  -> Saksi returns the commitment (logAccess args) and a submitToken
//   2. signs AccessJournal.logAccess(args) with the controller's registered key (Saksi never holds that key)
//   3. POST /api/controller/access/submit   -> Saksi checks the tx on Sepolia matches the draft and the signer
//   4. POST /api/controller/access/confirm  -> polled until the event is mined: status "anchored"
// The citizen's phone then receives the receipt and verifies it against the chain itself.
//
// Run from web/:
//   CONTROLLER_PRIVATE_KEY=0x... CONTROLLER_SLUG=demo-spare CITIZEN_CODE=JVHULK node scripts/agency-example.mjs
//
// Env:
//   SAKSI_URL               Saksi deployment (default https://saksiku.web.id)
//   CONTROLLER_PRIVATE_KEY  key of the wallet registered for this controller in ControllerRegistry (never logged)
//   CONTROLLER_ID           bytes32 controller id, or CONTROLLER_SLUG to derive keccak256("ctrl:" + slug)
//   CITIZEN_CODE            the citizen's 6-character Saksi code (not a NIK: the agency maps it in its own system)
//   PURPOSE                 purpose text shown to the citizen (default below)
//   LEGAL_BASIS             PDP-20-2-a … PDP-20-2-f (default PDP-20-2-e, public task)
//   EVENT_TYPE              0 READ, 1 UPDATE, 2 EXPORT, 3 SHARE_THIRD_PARTY (default 0)
//   RPC_URL                 Sepolia RPC (default https://ethereum-sepolia-rpc.publicnode.com)
import { readFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// ABI and addresses come from the repo: lib/shared/abi.ts is generated from the Solidity sources by
// generate-abi.mjs, and contracts/deployments/sepolia.json is written by the deploy script.
const abiSource = readFileSync(new URL('../lib/shared/abi.ts', import.meta.url), 'utf8');
const generatedAbi = (name) => JSON.parse(abiSource.match(new RegExp(`export const ${name} = (\\[[\\s\\S]*?\\n\\]) as const;`))[1]);
const accessAbi = generatedAbi('accessAbi');
const registryAbi = generatedAbi('registryAbi');
const deployment = JSON.parse(readFileSync(new URL('../../contracts/deployments/sepolia.json', import.meta.url), 'utf8'));
const journal = deployment.contracts.AccessJournal;
const registry = deployment.contracts.ControllerRegistry;

const env = process.env;
const SAKSI_URL = (env.SAKSI_URL || 'https://saksiku.web.id').replace(/\/+$/, '');
const RPC_URL = env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const fail = (message) => { console.error(`error: ${message}`); process.exit(1); };

if (!/^0x[0-9a-fA-F]{64}$/.test(env.CONTROLLER_PRIVATE_KEY ?? '')) fail('CONTROLLER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key.');
const controllerId = env.CONTROLLER_ID || (env.CONTROLLER_SLUG && keccak256(toBytes(`ctrl:${env.CONTROLLER_SLUG}`)));
if (!/^0x[0-9a-fA-F]{64}$/.test(controllerId ?? '')) fail('Set CONTROLLER_ID (bytes32) or CONTROLLER_SLUG.');
const subjectCode = (env.CITIZEN_CODE ?? '').trim().toUpperCase();
if (!/^[A-HJ-NP-Z2-9]{6}$/.test(subjectCode)) fail('CITIZEN_CODE must be a 6-character Saksi citizen code.');
const eventType = Number(env.EVENT_TYPE ?? 0);
if (![0, 1, 2, 3].includes(eventType)) fail('EVENT_TYPE must be 0, 1, 2 or 3.');
const legalBasisKey = env.LEGAL_BASIS || 'PDP-20-2-e';
const purposeText = env.PURPOSE || 'Officer opened the record to process a service request';

const account = privateKeyToAccount(env.CONTROLLER_PRIVATE_KEY);
const chain = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Every Saksi error body is { error: { code, message } }. Server-to-server calls send no Origin header,
// which the API accepts; a browser on another origin gets 403 BAD_ORIGIN.
async function saksi(path, body) {
  const response = await fetch(`${SAKSI_URL}/api/controller/access/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error?.message ?? `HTTP ${response.status}`);
    error.code = data?.error?.code ?? 'HTTP_ERROR';
    throw error;
  }
  return data;
}

// TX_NOT_VISIBLE: the server's RPCs have not seen the fresh broadcast yet. UNAVAILABLE / RATE_LIMITED: transient.
const RETRYABLE = new Set(['TX_NOT_VISIBLE', 'UNAVAILABLE', 'RATE_LIMITED']);
async function retrying(step, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  for (let delay = 2_000; ; delay = Math.min(5_000, Math.round(delay * 1.5))) {
    try {
      const value = await step();
      if (value !== undefined) return value;
    } catch (error) {
      if (!RETRYABLE.has(error.code) && error.name !== 'TimeoutError') throw error;
      console.log(`  … ${error.code ?? error.name}, retrying`);
    }
    if (Date.now() + delay > deadline) throw new Error('Gave up after 3 minutes; run confirm again later.');
    await sleep(delay);
  }
}

// The registry decides who may write for this controller; check before spending gas.
const authorized = await chain.readContract({ address: registry, abi: registryAbi, functionName: 'isAuthorized', args: [controllerId, account.address] });
if (!authorized) fail(`${account.address} is not the registered wallet for controller ${controllerId}.`);

// 1. Prepare: Saksi stores the opening (purpose text, salts, evidence) encrypted and returns only commitments.
const { id, submitToken, args } = await saksi('prepare', { controllerId, subjectCode, purposeText, legalBasisKey, eventType });
if (args[0].toLowerCase() !== controllerId.toLowerCase() || args[4] !== eventType) fail('prepare returned arguments for a different request.');
console.log(`prepared  ${id}`);

// 2. Sign: the agency's own key sends logAccess with exactly the prepared arguments.
const txHash = await wallet.writeContract({ address: journal, abi: accessAbi, functionName: 'logAccess', args });
console.log(`sent      ${txHash}`);

// 3. Submit: Saksi accepts the hash only if Sepolia shows a logAccess call with these args from an authorized wallet.
await retrying(() => saksi('submit', { id, txHash, submitToken }));
console.log('submitted');

// 4. Confirm: "submitted" means not mined (or not visible to Saksi's RPCs) yet; keep asking.
const result = await retrying(async () => {
  const answer = await saksi('confirm', { id });
  return answer.status === 'submitted' ? undefined : answer;
});
if (result.status !== 'anchored') fail(`confirm answered ${result.status}: ${result.reason ?? 'no reason given'}`);

const receipt = await chain.waitForTransactionReceipt({ hash: txHash });
const log = receipt.logs.find((entry) => entry.address.toLowerCase() === journal.toLowerCase());
console.log(`anchored  block ${receipt.blockNumber}`);
console.log(`proof     ${SAKSI_URL}/proof/${txHash}/${log?.logIndex ?? 0}`);
console.log(`explorer  https://sepolia.etherscan.io/tx/${txHash}`);
