import { controllerId, legalBasisKey } from '@/lib/shared/commit'
import { CONTRACTS, SITE_URL } from '@/lib/env'

/**
 * Copy and reference data for /integrate. Every request/response shape, error code and on-chain field below is
 * read from the implementation: app/api/[...path]/route.ts, lib/server/{access,chain,http,submit-token}.ts,
 * lib/shared/commit.ts and contracts/src/AccessJournal.sol. The TypeScript snippet mirrors
 * scripts/agency-example.mjs, which was run end to end against production.
 */

const journal = CONTRACTS.AccessJournal ?? '0x<AccessJournal address>'
// A fictional public-sector controller registered on Sepolia; a real agency gets its own id bound to its own key.
export const DEMO_CONTROLLER_SLUG = 'rsud-contoh'
export const DEMO_CONTROLLER_ID = controllerId(DEMO_CONTROLLER_SLUG)

export const TS_SNIPPET = `import { createWalletClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { accessAbi } from './abi' // generated from AccessJournal.sol (web/lib/shared/abi.ts)

const SAKSI_URL = '${SITE_URL}'
const JOURNAL = '${journal}' // AccessJournal on Sepolia
const CONTROLLER_ID = process.env.CONTROLLER_ID as Hex // keccak256("ctrl:" + slug), bound to your key on chain

// Any viem account works: a local key, or one backed by your HSM or cloud KMS.
const account = privateKeyToAccount(process.env.CONTROLLER_PRIVATE_KEY as Hex)
const wallet = createWalletClient({ account, chain: sepolia, transport: http(process.env.RPC_URL) })

type Prepared = { id: string; submitToken: string; args: readonly [Hex, Hex, Hex, Hex, number, Hex] }
type Confirmed = { status: 'submitted' | 'anchored' | 'failed'; reason?: string }

// Errors come back as { error: { code, message } }. Server-to-server calls send no Origin header: accepted.
async function saksi<T>(action: 'prepare' | 'submit' | 'confirm', body: object): Promise<T> {
  const res = await fetch(\`\${SAKSI_URL}/api/controller/access/\${action}\`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.error.message), { code: data.error.code as string })
  return data as T
}

// TX_NOT_VISIBLE: Saksi's RPCs have not seen the broadcast yet. TX_MISMATCH, TX_NOT_AUTHORIZED: final.
const RETRYABLE = new Set(['TX_NOT_VISIBLE', 'UNAVAILABLE', 'RATE_LIMITED'])
async function retrying<T>(step: () => Promise<T | undefined>): Promise<T> {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    try {
      const value = await step()
      if (value !== undefined) return value
    } catch (error) {
      if (!RETRYABLE.has((error as { code?: string }).code ?? '')) throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000))
  }
  throw new Error('Sepolia is slow right now; call confirm again later.')
}

type DataCategory = 'identity' | 'address' | 'contact' | 'financial' | 'health' | 'employment' | 'biometric' | 'other'

// Call this from the code path that opens a citizen record.
export async function sealAccess(citizenCode: string, purposeText: string, dataCategories: DataCategory[], operatorRef = 'officer') {
  // 1. Saksi returns commitments only, plus a token bound to this draft.
  const { id, submitToken, args } = await saksi<Prepared>('prepare', {
    controllerId: CONTROLLER_ID,
    subjectCode: citizenCode, // the citizen's Saksi code, never a NIK
    purposeText, // shown to the citizen; only its salted hash goes on chain
    legalBasisKey: 'PDP-20-2-e', // UU PDP Art. 20(2)(e): public task
    eventType: 0, // 0 READ · 1 UPDATE · 2 EXPORT · 3 SHARE_THIRD_PARTY
    system: 'agency-backend', // where the record was opened; omit it and Saksi uses your registered name
    dataCategories, // e.g. ['identity', 'health']: what the officer opened, shown on the citizen's receipt
    operatorRef, // a desk or role reference, never a name
  })

  // 2. Your key signs. Saksi never holds it, so it can neither forge nor hide your entries.
  const txHash = await wallet.writeContract({ address: JOURNAL, abi: accessAbi, functionName: 'logAccess', args })

  // 3. Saksi checks Sepolia: same contract, same arguments, sent by your registered wallet.
  await retrying(() => saksi('submit', { id, txHash, submitToken }))

  // 4. "submitted" = not mined yet. "anchored" = the citizen's receipt is live.
  const result = await retrying(async () => {
    const answer = await saksi<Confirmed>('confirm', { id })
    return answer.status === 'submitted' ? undefined : answer
  })
  if (result.status !== 'anchored') throw new Error(result.reason)
  return { id, txHash }
}
`

export const CURL_SNIPPET = `curl -X POST ${SITE_URL}/api/controller/access/prepare \\
  -H 'content-type: application/json' \\
  -d '{
    "controllerId": "${DEMO_CONTROLLER_ID}",
    "subjectCode": "JVHULK",
    "purposeText": "Officer opened the record to process a service request",
    "legalBasisKey": "PDP-20-2-e",
    "eventType": 0,
    "system": "agency-backend",
    "dataCategories": ["identity", "contact"],
    "operatorRef": "officer"
  }'`

export const RESPONSE_SNIPPET = `HTTP/1.1 201 Created
{
  "id": "4c21a490-f991-4fc9-8af5-da591968d586",
  "submitToken": "<43-character token, echo it to submit>",
  "args": [
    "${DEMO_CONTROLLER_ID}",
    "0x…",  // subjectPseudonym
    "0x…",  // purposeHash
    "${legalBasisKey('PDP-20-2-e')}",
    0,
    "0x…"   // evidenceHash
  ]
}`

export const RUN_SNIPPET = `cd web
CONTROLLER_PRIVATE_KEY=0x… \\
CONTROLLER_SLUG=${DEMO_CONTROLLER_SLUG} \\
CITIZEN_CODE=JVHULK \\
DATA_CATEGORIES=identity,health \\
node scripts/agency-example.mjs`

export const RUN_OUTPUT = `prepared  4c21a490-f991-4fc9-8af5-da591968d586
sent      0xa53c…cb53
submitted
anchored  block 12182996
proof     ${SITE_URL}/proof/0xa53c…cb53/240`

/** AccessLogged / logAccess fields, in event order. */
export const ON_CHAIN = [
  { field: 'controllerId', type: 'bytes32', what: 'Who accessed. keccak256("ctrl:" + slug), bound to one wallet in ControllerRegistry.' },
  { field: 'subjectPseudonym', type: 'bytes32', what: 'Whose record. An HMAC of the citizen with a per-controller salt, so two agencies’ entries for one person cannot be linked.' },
  { field: 'purposeHash', type: 'bytes32', what: 'Why. keccak256 of the purpose text and a random salt.' },
  { field: 'legalBasisKey', type: 'bytes32', what: 'On what basis. The UU PDP Art. 20(2) key, PDP-20-2-a to f, as text.' },
  { field: 'eventType', type: 'uint8', what: 'What was done. 0 read, 1 update, 2 export, 3 shared with a third party.' },
  { field: 'evidenceHash', type: 'bytes32', what: 'keccak256 of the canonical JSON evidence descriptor: system, data categories, officer reference, request time and a nonce.' },
  { field: 'timestamp', type: 'uint64', what: 'When. The block time, set by the chain, not by you or Saksi.' },
] as const

export const HELD_BY_SAKSI = [
  'Purpose text',
  'Purpose salt',
  'Evidence descriptor',
  'Citizen code ↔ pseudonym salt',
] as const

export const NEVER_LEAVES = [
  'Citizen name',
  'NIK and other ID numbers',
  'The record the officer opened',
  'Your database and its schema',
  'Your signing key',
] as const

export type Endpoint = { method: 'GET' | 'POST'; path: string; purpose: string }
export const ENDPOINT_GROUPS: { title: string; note: string; rows: Endpoint[] }[] = [
  {
    title: 'Access receipts',
    note: 'The hook. Prepare is open and rate-limited (20 drafts a minute per network); submit needs the submitToken that prepare returned.',
    rows: [
      { method: 'POST', path: '/api/controller/access/prepare', purpose: 'Draft one access. Returns id, submitToken and the six logAccess arguments.' },
      { method: 'POST', path: '/api/controller/access/submit', purpose: 'Attach the signed tx. Rejected unless Sepolia shows a matching logAccess from your registered wallet.' },
      { method: 'POST', path: '/api/controller/access/confirm', purpose: 'Poll until anchored. Answers submitted, anchored, or failed with a reason.' },
      { method: 'GET', path: '/api/controller/access/recent?controllerId=', purpose: 'Your last ten signed records, citizen code masked to two characters.' },
    ],
  },
  {
    title: 'Breach notices',
    note: 'Same three steps, signed to BreachReport.anchor, or anchorLate once the 72 hours have passed.',
    rows: [
      { method: 'POST', path: '/api/controller/breach/prepare', purpose: 'Draft a UU PDP Art. 46 notice. Returns the anchor arguments, mode and deadline.' },
      { method: 'POST', path: '/api/controller/breach/submit', purpose: 'Attach the signed anchor or anchorLate transaction.' },
      { method: 'POST', path: '/api/controller/breach/confirm', purpose: 'Poll until anchored. Returns on_time or late, with lateBySec.' },
    ],
  },
  {
    title: 'Public reads',
    note: 'No session, no key. What a regulator or journalist can check without asking you.',
    rows: [
      { method: 'GET', path: '/api/watch?controllerId=', purpose: 'Every chain event reconciled with the database row: MATCH, ALTERED, DELETED, NOT_ANCHORED.' },
      { method: 'GET', path: '/api/regulator/breaches', purpose: 'Sealed breach notices with on-time and late counts.' },
      { method: 'GET', path: '/api/stats', purpose: 'Citizens, sealed receipts, last seal time, recent records masked.' },
    ],
  },
]

export type ErrorRow = { code: string; status: number; step: string; meaning: string; retry: boolean }
export const ERRORS: ErrorRow[] = [
  { code: 'TX_NOT_VISIBLE', status: 409, step: 'submit', meaning: 'Saksi’s RPCs have not seen the broadcast yet.', retry: true },
  { code: 'TX_MISMATCH', status: 400, step: 'submit', meaning: 'The tx is not logAccess on the journal with exactly the prepared arguments.', retry: false },
  { code: 'TX_NOT_AUTHORIZED', status: 403, step: 'submit', meaning: 'The sending wallet is not registered for this controller.', retry: false },
  { code: 'SUBMIT_TOKEN_INVALID', status: 403, step: 'submit', meaning: 'The token does not belong to this draft. Prepare again.', retry: false },
  { code: 'UNKNOWN_CITIZEN', status: 404, step: 'prepare', meaning: 'No citizen with that Saksi code.', retry: false },
  { code: 'UNKNOWN_CONTROLLER', status: 404, step: 'prepare', meaning: 'The controller id is not registered on Sepolia.', retry: false },
  { code: 'BAD_ORIGIN', status: 403, step: 'any POST', meaning: 'A browser on another origin. Call from your backend instead.', retry: false },
  { code: 'RATE_LIMITED', status: 429, step: 'prepare', meaning: 'Too many drafts from this network this minute.', retry: true },
  { code: 'UNAVAILABLE', status: 503, step: 'any', meaning: 'Database or RPC hiccup on Saksi’s side.', retry: true },
]
