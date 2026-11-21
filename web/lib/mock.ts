// Synthetic data + an in-browser mock "server" so every screen works without the backend.
// All people, companies and hashes here are fictional. Types come from lib/shared/types.ts.
//
// Timeline of the demo (from the moment the page first asks for data):
//   +5 s   a NEW receipt arrives for the citizen (status ON CHAIN…)
//   +9 s   that receipt is sealed (RECORDED)
//   +4 s   on /regulator/watch, row R.0412 flips to ALTERED

import type {
  AiMeta,
  BreachRow,
  Pasal46Fields,
  ReceiptOpening,
  VerifyResult,
  WatchRow,
} from './shared/types'

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

/** Deterministic fake hex string (not a real hash; just looks like one). */
export function fakeHex(seed: string, bytes = 32): `0x${string}` {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < seed.length; i++) {
    h1 = Math.imul(h1 ^ seed.charCodeAt(i), 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ seed.charCodeAt(i), 0x5bd1e995) >>> 0
  }
  let out = ''
  let x = h1 ^ h2 || 1
  while (out.length < bytes * 2) {
    x ^= x << 13
    x >>>= 0
    x ^= x >>> 17
    x ^= x << 5
    x >>>= 0
    out += x.toString(16).padStart(8, '0')
  }
  return `0x${out.slice(0, bytes * 2)}`
}

/** bytes32 of a legal basis key, e.g. 'PDP-20-2-f' (stringToHex(key, { size: 32 })). */
function basisHex(key: string): `0x${string}` {
  let hex = ''
  for (const ch of key) hex += ch.charCodeAt(0).toString(16).padStart(2, '0')
  return `0x${hex.padEnd(64, '0')}`
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const isBrowser = () => typeof window !== 'undefined'

let bootAt = 0
/** Time (ms) when the mock first started serving this tab. */
function boot(): number {
  if (!bootAt) bootAt = Date.now()
  return bootAt
}

// ---------------------------------------------------------------------------------------------
// controllers
// ---------------------------------------------------------------------------------------------

export const CONTROLLERS = [
  { slug: 'contoh-lending', name: 'Contoh Lending Co. (fictional)', short: 'Contoh Lending Co.' },
  { slug: 'sehat-clinic', name: 'Sehat Clinic (fictional)', short: 'Sehat Clinic' },
] as const

const ctrlId = (slug: string) => fakeHex(`ctrl:${slug}`)

export const MOCK_CONTRACTS = {
  registry: '0x5a1c3E0b6f2D8a91C4e7B3d0F2a6c8E1b9D4f702' as `0x${string}`,
  journal: '0x9C3f1a7E2b5D8c0A4e6F1b3D7a9C2e5F8b0D3a61' as `0x${string}`,
  breach: '0x3E8b1D4f7A0c2E5b9D1f3A6c8E0b2D4f6A8c1E93' as `0x${string}`,
}

export const MOCK_BLOCK_BASE = 7_123_456

/** Block number that advances every 12 s, like Sepolia. */
export function mockBlockNumber(): number {
  if (!isBrowser()) return MOCK_BLOCK_BASE
  return MOCK_BLOCK_BASE + Math.floor((Date.now() - boot()) / 12_000)
}

// ---------------------------------------------------------------------------------------------
// citizen
// ---------------------------------------------------------------------------------------------

export type MockSession = { code: string; displayName: string; createdAt: number }
export type ReceiptsResponse = {
  receipts: ReceiptOpening[]
  profile: { code: string; displayName: string }
}

const SESSION_KEY = 'saksi.mock.session'
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function readSession(): MockSession | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as MockSession) : null
  } catch {
    return null
  }
}

export function mockGetSession(): MockSession | null {
  return readSession()
}

export async function mockCreateSession(): Promise<MockSession> {
  await sleep(700)
  let code = ''
  const rnd = new Uint32Array(6)
  crypto.getRandomValues(rnd)
  for (const n of rnd) code += CODE_ALPHABET[n % CODE_ALPHABET.length]
  const session: MockSession = { code, displayName: `Synthetic citizen ${code.slice(0, 3)}`, createdAt: Date.now() }
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Private mode: the session lives only in memory for this tab.
  }
  bootAt = Date.now()
  return session
}

export async function mockDeleteSession(): Promise<void> {
  await sleep(400)
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

type Seed = {
  id: string
  ctrl: 0 | 1
  eventType: 0 | 1 | 2 | 3
  purpose: string
  basis: string
  agoMin: number
  system: string
  categories: string[]
}

const SEEDS: Seed[] = [
  {
    id: 'evt_7Q2M4K',
    ctrl: 0,
    eventType: 3,
    purpose: 'Debt collection',
    basis: 'PDP-20-2-f',
    agoMin: 47,
    system: 'collections-crm',
    categories: ['phone', 'loan balance'],
  },
  {
    id: 'evt_3HX9PA',
    ctrl: 1,
    eventType: 0,
    purpose: 'Check-up appointment',
    basis: 'PDP-20-2-b',
    agoMin: 60 * 5 + 12,
    system: 'clinic-ehr',
    categories: ['name', 'medical record'],
  },
  {
    id: 'evt_K8D2RW',
    ctrl: 0,
    eventType: 1,
    purpose: 'Update home address',
    basis: 'PDP-20-2-b',
    agoMin: 60 * 26,
    system: 'core-banking',
    categories: ['address'],
  },
  {
    id: 'evt_P5TN6E',
    ctrl: 1,
    eventType: 2,
    purpose: 'Insurance claim export',
    basis: 'PDP-20-2-a',
    agoMin: 60 * 24 * 4,
    system: 'claims-gateway',
    categories: ['diagnosis', 'invoice'],
  },
]

const NEW_SEED: Seed = {
  id: 'evt_N3W8ZC',
  ctrl: 0,
  eventType: 0,
  purpose: 'Credit score check',
  basis: 'PDP-20-2-a',
  agoMin: 0,
  system: 'risk-engine',
  categories: ['credit history'],
}

function toOpening(seed: Seed, createdAtMs: number, status: ReceiptOpening['status'], code: string): ReceiptOpening {
  const c = CONTROLLERS[seed.ctrl]
  const controllerId = ctrlId(c.slug)
  const anchored = status === 'anchored'
  return {
    eventId: seed.id,
    controllerId,
    controllerName: c.name,
    subjectPseudonym: fakeHex(`pseudo:${code}:${c.slug}`),
    purposeText: seed.purpose,
    purposeSalt: fakeHex(`salt:${seed.id}`),
    legalBasisKey: basisHex(seed.basis),
    eventType: seed.eventType,
    evidence: {
      v: 1,
      eventId: seed.id,
      nonce: fakeHex(`nonce:${seed.id}`),
      controllerId,
      system: seed.system,
      dataCategories: seed.categories,
      operatorRef: `op-${seed.id.slice(4, 8).toLowerCase()}`,
      requestedAt: new Date(createdAtMs).toISOString(),
    },
    txHash: status === 'pending' ? null : fakeHex(`tx:${seed.id}`),
    logIndex: anchored ? (seed.id.charCodeAt(5) % 7) + 1 : null,
    status,
    createdAt: new Date(createdAtMs).toISOString(),
  }
}

/** Every receipt the demo knows about (used by detail pages, even without a session). */
export function mockAllReceipts(now = Date.now(), code = 'DEMO42'): ReceiptOpening[] {
  return [NEW_SEED, ...SEEDS].map((s) => toOpening(s, now - s.agoMin * 60_000, 'anchored', code))
}

export type ReceiptsScenario = 'live' | 'empty' | 'error' | 'slow'

export async function mockGetReceipts(scenario: ReceiptsScenario = 'live'): Promise<ReceiptsResponse> {
  const session = readSession()
  const code = session?.code ?? 'DEMO42'
  const t0 = boot()
  const now = Date.now()
  await sleep(scenario === 'slow' ? 60_000 : 350)
  if (scenario === 'error') throw new Error('The Saksi server did not answer in time. Your receipts are safe on chain.')
  const profile = { code, displayName: session?.displayName ?? 'Synthetic citizen' }
  if (scenario === 'empty') return { receipts: [], profile }

  const receipts = SEEDS.map((s) => toOpening(s, now - s.agoMin * 60_000, 'anchored', code))
  const arriveAt = t0 + 5_000
  if (now >= arriveAt) {
    const status: ReceiptOpening['status'] =
      now < arriveAt + 2_000 ? 'pending' : now < arriveAt + 4_000 ? 'submitted' : 'anchored'
    receipts.unshift(toOpening(NEW_SEED, arriveAt, status, code))
  }
  return { receipts, profile }
}

export function mockFindReceipt(eventId: string): ReceiptOpening | null {
  const session = readSession()
  return mockAllReceipts(Date.now(), session?.code ?? 'DEMO42').find((r) => r.eventId === eventId) ?? null
}

// ---------------------------------------------------------------------------------------------
// verify + AI
// ---------------------------------------------------------------------------------------------

export type VerifyDemo = 'match' | 'altered' | 'notfound'

export async function mockVerify(opening: ReceiptOpening, demo: VerifyDemo = 'match'): Promise<VerifyResult> {
  const started = performance.now()
  await sleep(demo === 'notfound' ? 2_400 : 1_700 + (opening.eventId.charCodeAt(6) % 5) * 60)
  const elapsedMs = Math.round(performance.now() - started)
  if (demo === 'notfound') {
    return { status: 'NOT_FOUND', mismatches: [], elapsedMs, rpc: 'ethereum-sepolia-rpc.publicnode.com' }
  }
  const base = {
    blockNumber: MOCK_BLOCK_BASE - 214,
    blockTime: Math.floor(new Date(opening.createdAt).getTime() / 1000) + 14,
    confirmations: 214,
    elapsedMs,
    rpc: 'ethereum-sepolia-rpc.publicnode.com',
  }
  if (demo === 'match') return { status: 'MATCH', mismatches: [], ...base }
  return {
    status: 'MISMATCH',
    mismatches: [
      { field: 'eventType', db: 'READ', chain: 'SHARE_THIRD_PARTY' },
      {
        field: 'purpose',
        db: `"Account review" (fingerprint 0x4be1a0…c27d19)`,
        chain: `A different purpose (fingerprint 0x91c4f2…07ab3e)`,
      },
    ],
    ...base,
  }
}

export type ExplainResponse = { text: string; meta: AiMeta }
export type AiDemo = 'primary' | 'fallback' | 'cached' | 'template' | 'error'

export async function mockExplain(
  verdict: 'MATCH' | 'ALTERED' | 'NOT FOUND ON THIS NODE',
  opening: ReceiptOpening,
  demo: AiDemo = 'primary',
): Promise<ExplainResponse> {
  await sleep(demo === 'cached' ? 250 : 1_400)
  if (demo === 'error') throw new Error('The AI service is busy. The verdict above does not depend on it.')
  const who = opening.controllerName.replace(' (fictional)', '')
  const text =
    verdict === 'MATCH'
      ? `${who} recorded this access at the time shown, and nobody has changed the record since. Your phone compared the record with the fingerprint sealed on the public chain and every field matched. This shows the record is original. It does not show the access itself was lawful — if the stated reason looks wrong to you, you can ask ${who} about it.`
      : verdict === 'ALTERED'
        ? `The company's database now says this was a simple "read", but the chain sealed it as "shared with a third party" with a different purpose. Someone changed the record after it was sealed. Keep this screen: the field table above is concrete evidence you can attach to a complaint to the regulator (UU PDP).`
        : `Your phone could not find this record on the node it asked. That usually means the node is slow or the transaction is still being mined. It is not evidence of tampering. Try another node, or check again in a minute.`
  const meta: AiMeta =
    demo === 'template'
      ? { provider: 'saksi', model: 'template-v1', fallbackLevel: 'template', latencyMs: 4 }
      : demo === 'fallback'
        ? { provider: 'example-provider', model: 'example-mini', fallbackLevel: 'fallback', latencyMs: 2210 }
        : demo === 'cached'
          ? { provider: 'example-provider', model: 'example-large', fallbackLevel: 'cached', latencyMs: 12 }
          : { provider: 'example-provider', model: 'example-large', fallbackLevel: 'primary', latencyMs: 1380 }
  return { text, meta }
}

// ---------------------------------------------------------------------------------------------
// controller
// ---------------------------------------------------------------------------------------------

export type RecentAccess = {
  id: string
  citizenCode: string
  eventType: 0 | 1 | 2 | 3
  purposeText: string
  status: ReceiptOpening['status']
  txHash: `0x${string}` | null
  createdAt: string
}

export function mockRecentAccess(now = Date.now()): RecentAccess[] {
  const rows: Array<[string, 0 | 1 | 2 | 3, string, number, ReceiptOpening['status']]> = [
    ['K7M2QD', 3, 'Debt collection', 47, 'anchored'],
    ['R4WT9A', 0, 'Credit score check', 63, 'anchored'],
    ['B2XJ6P', 1, 'Update phone number', 180, 'anchored'],
    ['H9CN3E', 2, 'Regulator audit export', 60 * 22, 'failed'],
  ]
  return rows.map(([code, eventType, purposeText, ago, status], i) => ({
    id: `acc_${i}${code}`,
    citizenCode: code,
    eventType,
    purposeText,
    status,
    txHash: status === 'pending' ? null : fakeHex(`acc:${code}`),
    createdAt: new Date(now - ago * 60_000).toISOString(),
  }))
}

export async function mockDraftBreach(narrative: string): Promise<{ fields: Pasal46Fields; meta: AiMeta }> {
  await sleep(1_600)
  const words = narrative.trim() || 'A misconfigured storage bucket exposed a customer export file.'
  return {
    fields: {
      dataAffected: 'Names, phone numbers and loan balances of about 1,240 borrowers. No ID numbers or passwords.',
      whenAndHow: `Detected on the date below by our security team. ${words.replace(/\s+/g, ' ').slice(0, 160)}`,
      actionsTaken:
        'Public access to the file was removed within 40 minutes. Access keys were rotated and affected borrowers will be contacted by SMS.',
      contact: 'Data Protection Officer — dpo@contoh-lending.example (fictional), +62 21 0000 0000',
    },
    meta: { provider: 'example-provider', model: 'example-large', fallbackLevel: 'primary', latencyMs: 1544 },
  }
}

// ---------------------------------------------------------------------------------------------
// regulator: breaches
// ---------------------------------------------------------------------------------------------

export function mockBreaches(nowSec = Math.floor(Date.now() / 1000)): BreachRow[] {
  const h = 3600
  return [
    {
      id: 'brc_01',
      controllerName: 'Contoh Lending Co. (fictional)',
      title: 'Customer export left in a public bucket',
      detectedAt: nowSec - 30 * h,
      anchoredAt: nowSec - 30 * h + Math.round(18.5 * h),
      mode: 'on_time',
      lateBySec: 0,
      hoursUsed: 18.5,
      txHash: fakeHex('brc:01'),
      status: 'anchored',
    },
    {
      id: 'brc_02',
      controllerName: 'Sehat Clinic (fictional)',
      title: 'Appointment system accessed with a stolen password',
      detectedAt: nowSec - 140 * h,
      anchoredAt: nowSec - 140 * h + 100 * h,
      mode: 'late',
      lateBySec: 28 * h,
      hoursUsed: 100,
      txHash: fakeHex('brc:02'),
      status: 'anchored',
    },
    {
      id: 'brc_03',
      controllerName: 'Sehat Clinic (fictional)',
      title: 'Lab results emailed to the wrong patient',
      detectedAt: nowSec - 9 * 24 * h,
      anchoredAt: nowSec - 9 * 24 * h + 61 * h,
      mode: 'on_time',
      lateBySec: 0,
      hoursUsed: 61,
      txHash: fakeHex('brc:03'),
      status: 'anchored',
    },
    {
      id: 'brc_04',
      controllerName: 'Contoh Lending Co. (fictional)',
      title: 'Call-centre laptop lost in transit',
      detectedAt: nowSec - 14 * 24 * h,
      anchoredAt: nowSec - 14 * 24 * h + 6 * h,
      mode: 'on_time',
      lateBySec: 0,
      hoursUsed: 6,
      txHash: fakeHex('brc:04'),
      status: 'anchored',
    },
  ]
}

// ---------------------------------------------------------------------------------------------
// regulator: watch
// ---------------------------------------------------------------------------------------------

export type WatchRowView = WatchRow & { ref: string; changedAt?: number }

export function mockWatch(): WatchRowView[] {
  const t0 = boot()
  const now = Date.now()
  const rows: WatchRowView[] = [
    ['0418', 0, 'MATCH'],
    ['0417', 1, 'MATCH'],
    ['0416', 0, 'MATCH'],
    ['0415', 0, 'NOT_ANCHORED'],
    ['0414', 1, 'MATCH'],
    ['0413', 0, 'MATCH'],
    ['0412', 0, 'MATCH'],
    ['0411', 1, 'MATCH'],
    ['0410', 1, 'DELETED'],
    ['0409', 0, 'MATCH'],
    ['0408', 1, 'MATCH'],
  ].map(([ref, ctrl, status], i) => {
    const r = ref as string
    const base: WatchRowView = {
      ref: `R.${r}`,
      eventId: status === 'DELETED' ? null : `evt_${r}`,
      txHash: fakeHex(`watch:${r}`),
      logIndex: (i % 4) + 1,
      controllerName: CONTROLLERS[ctrl as 0 | 1].name,
      status: status as WatchRow['status'],
      blockNumber: status === 'NOT_ANCHORED' ? undefined : MOCK_BLOCK_BASE - 40 - i * 37,
    }
    if (status === 'DELETED') {
      base.field = 'row'
      base.dbValue = '— (row deleted)'
      base.chainValue = 'READ · Account review · Contract'
    }
    if (status === 'NOT_ANCHORED') {
      base.field = 'txHash'
      base.dbValue = 'Saved, never sent to chain'
      base.chainValue = '—'
    }
    return base
  })

  const flipAt = t0 + 4_000
  if (now >= flipAt) {
    const row = rows.find((r) => r.ref === 'R.0412')
    if (row) {
      row.status = 'ALTERED'
      row.field = 'eventType'
      row.dbValue = 'READ'
      row.chainValue = 'SHARE_THIRD_PARTY'
      row.changedAt = flipAt
    }
  }
  return rows
}

// ---------------------------------------------------------------------------------------------
// /dev gallery loaders. The app screens never import these; the galleries pass them into the
// containers (BreachList `load`, WatchView `load`, ProofResult `verify`, …) to show every state.
// ---------------------------------------------------------------------------------------------

export type GalleryScenario = 'live' | 'loading' | 'empty' | 'error' | 'stale' | 'notfound'

const hang = () => new Promise<never>(() => {})
const fail = async (message: string): Promise<never> => {
  await sleep(400)
  throw new Error(message)
}

const MOCK_PASAL46: Record<string, Pasal46Fields> = {
  brc_01: {
    dataAffected: 'Names, phone numbers and loan amounts of 1,240 customers (synthetic).',
    whenAndHow: 'A nightly export was written to a storage bucket that was public for 6 hours.',
    actionsTaken: 'Bucket made private, export deleted, access keys rotated, logs reviewed.',
    contact: 'privacy@contoh-lending.example (fictional)',
  },
  brc_02: {
    dataAffected: 'Appointment dates and doctor names of 312 patients (synthetic).',
    whenAndHow: 'A staff password reused on another site was used to sign in to the booking system.',
    actionsTaken: 'Account locked, all staff passwords reset, two-factor sign-in turned on.',
    contact: 'dpo@sehat-clinic.example (fictional)',
  },
}

export async function mockBreachList(scenario: GalleryScenario = 'live') {
  if (scenario === 'loading') return hang()
  if (scenario === 'error') return fail('Could not reach the Saksi server. Check your connection.')
  await sleep(300)
  const rows = scenario === 'empty' ? [] : mockBreaches()
  const onTime = rows.filter((r) => r.mode === 'on_time').length
  return { rows, stats: { total: rows.length, onTime, late: rows.length - onTime } }
}

export async function mockBreachDetail(id: string, scenario: GalleryScenario = 'live') {
  if (scenario === 'loading') return hang()
  if (scenario === 'error') return fail('Could not reach the Saksi server. Check your connection.')
  await sleep(300)
  const row = scenario === 'notfound' ? undefined : mockBreaches().find((r) => r.id === id)
  if (!row) return null
  return {
    ...row,
    pasal46: MOCK_PASAL46[row.id] ?? MOCK_PASAL46.brc_01,
    affectedCount: row.id === 'brc_02' ? 312 : 1240,
    contract: MOCK_CONTRACTS.breach,
    discoveryTxHash: null,
    reportHash: fakeHex(`report:${row.id}`),
    noticeHashMatches: true,
  }
}

export async function mockWatchView(scenario: GalleryScenario = 'live') {
  if (scenario === 'loading') return hang()
  if (scenario === 'error') return fail('The chain node did not answer in time.')
  await sleep(250)
  if (scenario === 'empty') return { rows: [], blockNumber: mockBlockNumber(), stale: false }
  return {
    rows: mockWatch(),
    blockNumber: scenario === 'stale' ? MOCK_BLOCK_BASE : mockBlockNumber(),
    stale: scenario === 'stale',
  }
}

/** Mock wallet for each of the 6 states, with the fields useWalletState() would fill at that point. */
export function mockWalletSnapshot(state: 'no_wallet' | 'disconnected' | 'wrong_network' | 'not_registered' | 'no_gas' | 'ready' = 'ready') {
  const connected = state !== 'no_wallet' && state !== 'disconnected'
  const registered = state === 'no_gas' || state === 'ready'
  return {
    state,
    isChecking: false,
    address: connected ? fakeHex('eoa:contoh-lending', 20) : undefined,
    controller: registered ? { id: fakeHex('ctrl:contoh-lending'), name: CONTROLLERS[0].name } : undefined,
    balance: registered ? BigInt(state === 'ready' ? '41200000000000000' : '300000000000000') : undefined,
    error: null,
    isConnecting: false,
    isSwitching: false,
  }
}

// ── STAGE UI ──
// Fixtures for the /stage gallery (app/dev/states/stage). Synthetic controllers ("Demo One/Two") and
// masked citizen codes only. The live /stage never imports these.

type StageStatsMock = import('./data').StageStatsWire
type StageWatchMock = import('./data').WatchView
type StageRecentMock = import('./data').StageRecentWire

export type StageMockState = 'idle' | 'live' | 'alert' | 'offline'
export type StageSnapshot = { stats: StageStatsMock; watch: StageWatchMock; failed: boolean; updatedAt: number }

const STAGE_FEED: Array<[name: string, ev: 0 | 1 | 2 | 3, code: string]> = [
  ['Demo One', 2, 'JV••••'],
  ['Demo Two', 0, '7K••••'],
  ['Demo One', 3, 'QF••••'],
  ['Demo Two', 1, 'M3••••'],
  ['Demo One', 0, 'R8••••'],
  ['Demo Two', 2, 'XC••••'],
  ['Demo One', 0, 'HT••••'],
]

function stageRow(i: number, at: number, status: StageRecentMock['status']): StageRecentMock {
  const [controllerName, eventType, citizenMasked] = STAGE_FEED[i % STAGE_FEED.length]
  return { id: `stg_${String(i).padStart(3, '0')}`, controllerName, eventType, citizenMasked, createdAt: new Date(at).toISOString(), status }
}

function stageWatch(recent: StageRecentMock[], extraMatches: number, alteredId: string | null, changedAt: number): StageWatchMock {
  const rows: WatchRowView[] = recent
    .filter((r) => r.status === 'anchored')
    .map((r, i) => ({
      ref: `R.${r.id.slice(-3)}`,
      eventId: r.id,
      txHash: fakeHex(`stage:${r.id}`),
      logIndex: i % 3,
      controllerName: r.controllerName,
      status: 'MATCH' as const,
      blockNumber: MOCK_BLOCK_BASE - 12 * i,
    }))
  for (let i = 0; i < extraMatches; i++) {
    rows.push({
      ref: `R.9${String(i).padStart(2, '0')}`,
      eventId: `stg_old_${i}`,
      txHash: fakeHex(`stage:old:${i}`),
      logIndex: 1,
      controllerName: STAGE_FEED[i % STAGE_FEED.length][0],
      status: 'MATCH',
      blockNumber: MOCK_BLOCK_BASE - 300 - i * 20,
    })
  }
  const hit = rows.find((r) => r.eventId === alteredId)
  if (hit) {
    hit.status = 'ALTERED'
    hit.field = 'eventType'
    hit.dbValue = 'READ'
    hit.chainValue = 'SHARE_THIRD_PARTY'
    hit.changedAt = changedAt
  }
  return { rows, blockNumber: MOCK_BLOCK_BASE + 1_088, stale: false }
}

/** One frozen snapshot per stage state, relative to `now` (the gallery passes a fixed clock). */
export function mockStageSnapshot(state: StageMockState, now: number): StageSnapshot {
  if (state === 'idle') {
    return {
      stats: { citizens: 3, receipts: 0, lastSealAt: null, recent: [] },
      watch: { rows: [], blockNumber: MOCK_BLOCK_BASE + 1_088, stale: false },
      failed: false,
      updatedAt: now - 2_000,
    }
  }
  const ages = [4, 12, 41, 75, 130, 260, 420]
  const recent = ages.map((s, i) => stageRow(i, now - s * 1000, i === 0 ? 'submitted' : 'anchored'))
  // Alert: the company rewrote row 3 in its database (SHARE → READ); the chain still has SHARE.
  if (state === 'alert') recent[2] = { ...recent[2], eventType: 0 }
  const stats: StageStatsMock = { citizens: 14, receipts: 23, lastSealAt: new Date(now - 12_000).toISOString(), recent }
  return {
    stats,
    watch: stageWatch(recent, 17, state === 'alert' ? recent[2].id : null, now - 3_000),
    failed: state === 'offline',
    updatedAt: now - 18_000,
  }
}

/**
 * Scripted demo for the gallery "play" frame, as two loaders (same shapes as getStageStats / getWatchView):
 *   0 s idle · +2 s first citizen · +5 s first receipt (sealing, then RECORDED 2 s later) · a new receipt every
 *   3.5 s · +26 s the third receipt (SHARE) is rewritten to READ in the database → alert.
 */
export function createStagePlayback(start = Date.now()) {
  const ARRIVALS = [5, 8.5, 12, 15.5, 19, 22.5].map((s) => s * 1000)
  const ALTER_AT = 26_000
  const snapshot = () => {
    const now = Date.now()
    const t = now - start
    const alteredId = t >= ALTER_AT ? stageRow(2, 0, 'anchored').id : null
    const recent = ARRIVALS.flatMap((at, i) => (t >= at ? [stageRow(i, start + at, t >= at + 2_000 ? 'anchored' : 'submitted')] : []))
      .map((r) => (r.id === alteredId ? { ...r, eventType: 0 as const } : r))
      .reverse()
    const sealed = recent.filter((r) => r.status === 'anchored')
    const citizens = (t >= 2_000 ? 1 : 0) + Math.max(0, Math.floor((t - 2_000) / 2_600))
    const stats: StageStatsMock = {
      citizens: Math.min(citizens, 12),
      receipts: sealed.length,
      lastSealAt: sealed[0] ? new Date(Date.parse(sealed[0].createdAt) + 2_000).toISOString() : null,
      recent,
    }
    const watch = stageWatch(recent, 0, alteredId, start + ALTER_AT)
    watch.blockNumber = MOCK_BLOCK_BASE + 1_088 + Math.floor(t / 12_000)
    return { stats, watch }
  }
  return {
    loadStats: async (): Promise<StageStatsMock> => {
      await sleep(120)
      return snapshot().stats
    },
    loadWatch: async (): Promise<StageWatchMock> => {
      await sleep(160)
      return snapshot().watch
    },
  }
}

// ── CONTROLLER UI ──
// Synchronous breach-draft fixture for the /dev/states/controller gallery: every breach frame renders
// its fields on first paint, so a "drafted" or "edited" state never shows empty fields.

export const CONTROLLER_DRAFT_FIXTURE: { fields: Pasal46Fields; meta: AiMeta } = {
  fields: {
    dataAffected: 'Names, phone numbers and loan balances of about 1,240 borrowers. No ID numbers or passwords.',
    whenAndHow:
      'Detected on the date below by our security team. A misconfigured storage bucket exposed a customer export file for about six hours before it was found.',
    actionsTaken:
      'Public access to the file was removed within 40 minutes. Access keys were rotated and affected borrowers will be contacted by SMS.',
    contact: 'Data Protection Officer — dpo@contoh-lending.example (fictional), +62 21 0000 0000',
  },
  meta: { provider: 'example-provider', model: 'example-large', fallbackLevel: 'primary', latencyMs: 1544 },
}

// ── CITIZEN WORKSPACE ── fixtures for /dev/states/citizen/workspace (laptop master–detail + profile).
// mockAllReceipts plus a third synthetic company and a repeat visit, so "who has opened your data" has
// more than one access per company. Gallery only; real pages read GET /api/citizen/receipts.

export function mockWorkspaceReceipts(now = Date.now(), code = 'DEMO42'): ReceiptOpening[] {
  const all = mockAllReceipts(now, code)
  const arta = { controllerId: fakeHex('ctrl:arta-insurance'), controllerName: 'Arta Insurance (fictional)' }
  const at = (min: number) => new Date(now - min * 60_000).toISOString()
  const extra: ReceiptOpening[] = [
    { ...all[4], ...arta, eventId: 'evt_A4RT1N', eventType: 0, purposeText: 'Policy renewal quote', txHash: fakeHex('tx:evt_A4RT1N'), createdAt: at(60 * 30) },
    { ...all[4], ...arta, eventId: 'evt_A7RT2X', eventType: 2, purposeText: 'Claims audit export', txHash: fakeHex('tx:evt_A7RT2X'), createdAt: at(60 * 24 * 6) },
    { ...all[1], eventId: 'evt_R3P9LD', eventType: 0, purposeText: 'Repayment reminder', txHash: fakeHex('tx:evt_R3P9LD'), createdAt: at(60 * 24 * 2) },
  ]
  return [...all, ...extra].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
