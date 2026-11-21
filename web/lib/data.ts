// Data facade for every screen. Every function here calls the real API (app/api/[...path]/route.ts)
// or the browser verifier (lib/shared/verify.ts). Mock data lives in lib/mock.ts and is used only by
// the /dev galleries, which pass their own loaders into the containers.
// Transactions (record access, anchor breach) run through useRecordAccess / useAnchorBreach in
// lib/client/controller.ts; the wallet through useWalletState in lib/client/wagmi.ts.
import { ApiClientError, getJson, postJson, requestJson } from './client/json'
import { getLang } from './client/lang'
import { CONTRACTS, explorerAddress, explorerTx } from './env'
import { proofPath } from './format'
import { controllerId as controllerIdOf } from './shared/commit'
import type {
  AiMeta,
  BreachRow,
  DataCategory,
  DemoReceipt,
  EventTypeCode,
  LegalBasisKey,
  Pasal46Fields,
  ReceiptOpening,
  RecordStatus,
  VerifyResult,
  WatchRow,
} from './shared/types'
import { EVENT_LABELS, LEGAL_BASES } from './shared/types'

export { ApiClientError }

type Hex = `0x${string}`
export type Verdict = 'MATCH' | 'ALTERED' | 'NOT FOUND ON THIS NODE'

/** UI verdict for a verifier result: MISMATCH is shown as ALTERED. */
export function verdictOf(result: Pick<VerifyResult, 'status'>): Verdict {
  return result.status === 'MATCH' ? 'MATCH' : result.status === 'MISMATCH' ? 'ALTERED' : 'NOT FOUND ON THIS NODE'
}

/**
 * Controllers registered by contracts/script/Deploy.s.sol: keccak256("ctrl:" + slug). Fallback only: the controller
 * wallet resolves its ids from the ControllerRegistered log (controllerCandidates, end of this file) and appends these.
 */
export const DEMO_CONTROLLER_IDS: readonly Hex[] = ['demo-one', 'demo-two', 'demo-spare'].map(controllerIdOf)

// ---- view shapes --------------------------------------------------------------------------------

export type CitizenProfile = { code: string; displayName: string }
/** GET /api/citizen/receipts. */
export type ReceiptsResponse = {
  receipts: ReceiptOpening[]
  pseudonyms: { controllerId: Hex; pseudonym: Hex }[]
  profile: CitizenProfile
}
export type ExplainResponse = { text: string; meta: AiMeta }

/** One row of GET /api/controller/access/recent. Purpose, salts and evidence are never sent there. */
export type RecentAccessWire = {
  id: string
  eventType: EventTypeCode
  action: string
  legalBasisKey: LegalBasisKey | null
  status: RecordStatus
  failReason: string | null
  txHash: Hex | null
  logIndex: number | null
  blockNumber: number | null
  subjectCodeHint: string | null
  createdAt: string
}
export type RecentAccess = {
  id: string
  /** Masked hint from the server ("7K••••"), never the full citizen code. */
  citizenCode: string
  eventType: EventTypeCode
  status: RecordStatus
  txHash: Hex | null
  createdAt: string
  legalBasisKey?: LegalBasisKey | null
  failReason?: string | null
  logIndex?: number | null
  blockNumber?: number | null
}

/** `fields` may carry extra keys from older servers (detectedAtGuess); toBreachDraft keeps only the four parts. */
export type DraftWire = { fields: Pasal46Fields; detectedAtGuess?: string; ai: AiMeta; aiRunId: string }
export type BreachDraft = { fields: Pasal46Fields; meta: AiMeta; aiRunId: string | null }
export type BreachListWire = { rows: BreachRow[]; stats: { total: number; onTime: number; late: number } }

/** GET /api/regulator/breaches/[id]. */
export type BreachDetailWire = BreachRow & {
  pasal46: Pasal46Fields
  ai: { model: string; promptVersionHash: Hex; outputHash: Hex } | null
  /** The notice fingerprint emitted by the BreachReport event (optional for older servers). */
  reportHash?: Hex
  discoveryAt: number
  deadline: number
}
/** One breach notice as the detail screen shows it. */
export type BreachDetailView = BreachRow & {
  pasal46: Pasal46Fields
  /** The API does not disclose the affected count (only its salted hash is on chain). */
  affectedCount: number | null
  /** BreachNotice contract from NEXT_PUBLIC_BREACH_ADDRESS; null when not configured. */
  contract: Hex | null
  /** Separate discovery transaction, when one exists. null: the discovery time is sealed inside the notice tx. */
  discoveryTxHash: Hex | null
  /** Notice hash; null when the API does not expose it. */
  reportHash: Hex | null
  /** true/false after the browser recomputed the notice hash against the chain; null = not re-checked. */
  noticeHashMatches: boolean | null
  /** AI provenance sealed inside the notice, when the draft came from AI. */
  ai?: BreachDetailWire['ai']
}

/** GET /api/watch. Stats keys are the row statuses. */
export type WatchWire = {
  rows: WatchRow[]
  stats: Record<WatchRow['status'], number>
  blockNumber: number
  checkedAt: string
}
export type WatchRowView = WatchRow & { ref: string; changedAt?: number }
/** `stale` is never set by the server; the screen marks data stale when a refresh fails. */
export type WatchView = { rows: WatchRowView[]; blockNumber: number; stale: boolean }

export type RpcNode = { id: string; label: string }

// ---- adapters (pure) ---------------------------------------------------------------------------

export function toRecentAccess(row: RecentAccessWire): RecentAccess {
  return {
    id: row.id,
    citizenCode: row.subjectCodeHint ?? '(deleted)',
    eventType: row.eventType,
    status: row.status,
    txHash: row.txHash,
    createdAt: row.createdAt,
    legalBasisKey: row.legalBasisKey,
    failReason: row.failReason,
    logIndex: row.logIndex,
    blockNumber: row.blockNumber,
  }
}

export function toBreachDraft(wire: DraftWire): BreachDraft {
  // Prepare rejects any key outside the four Art. 46 parts, so never forward the wire object as is.
  const { dataAffected, whenAndHow, actionsTaken, contact } = wire.fields
  return { fields: { dataAffected, whenAndHow, actionsTaken, contact }, meta: wire.ai, aiRunId: wire.aiRunId }
}

export function toBreachDetail(wire: BreachDetailWire, contract: Hex | null): BreachDetailView {
  return {
    id: wire.id,
    controllerName: wire.controllerName,
    title: wire.title,
    detectedAt: wire.detectedAt,
    anchoredAt: wire.anchoredAt,
    mode: wire.mode,
    lateBySec: wire.lateBySec,
    hoursUsed: wire.hoursUsed,
    txHash: wire.txHash,
    status: wire.status,
    pasal46: wire.pasal46,
    ai: wire.ai,
    affectedCount: null,
    contract,
    discoveryTxHash: null,
    reportHash: wire.reportHash ?? null,
    noticeHashMatches: null,
  }
}

/** Short, stable label for a Watch row; also its React key. */
export function watchRef(row: WatchRow): string {
  if (row.eventId) return `R.${row.eventId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
  return `TX.${row.txHash.slice(2, 8).toUpperCase()}:${row.logIndex}`
}

/**
 * Adds `ref` and `changedAt` to Watch rows. `seen` remembers each row's last status between polls,
 * so a row that flips (e.g. MATCH → ALTERED after a tamper) gets `changedAt = nowMs` and keeps it
 * until it flips again.
 */
export function toWatchRows(
  rows: WatchRow[],
  seen: Map<string, { status: WatchRow['status']; changedAt?: number }>,
  nowMs: number,
): WatchRowView[] {
  return rows.map((row) => {
    const ref = watchRef(row)
    const prev = seen.get(ref)
    const changedAt = prev && prev.status !== row.status ? nowMs : prev?.changedAt
    seen.set(ref, { status: row.status, changedAt })
    return changedAt === undefined ? { ...row, ref } : { ...row, ref, changedAt }
  })
}

/** "7K••QF". The live route already sends a hint like "7K••••"; that is shown as is. */
export function maskCitizenCode(code: string): string {
  if (code.includes('•') || code.length < 5) return code
  return `${code.slice(0, 2)}••${code.slice(-2)}`
}

/** Explorer link for a tx / address; base URL from NEXT_PUBLIC_EXPLORER_URL (lib/env.ts). */
export function explorerLink(kind: 'tx' | 'address', value: string): string {
  return kind === 'tx' ? explorerTx(value) : explorerAddress(value)
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

// ---- citizen -----------------------------------------------------------------------------------

export type CitizenErrorCode = 'RATE_LIMITED' | 'NO_SESSION' | 'NETWORK' | 'UNKNOWN'
export type CitizenError = { code: CitizenErrorCode; message: string }

/** Maps any thrown value to a UI error code. 401 SESSION_REQUIRED means "create a profile first". */
export function toCitizenError(err: unknown): CitizenError {
  if (err instanceof ApiClientError) {
    if (err.status === 429 || err.code === 'RATE_LIMITED') return { code: 'RATE_LIMITED', message: err.message }
    if (err.status === 401 || err.code === 'SESSION_REQUIRED') return { code: 'NO_SESSION', message: err.message }
    if (err.status === 0) return { code: 'NETWORK', message: err.message }
    return { code: 'UNKNOWN', message: err.message }
  }
  return { code: 'UNKNOWN', message: err instanceof Error ? err.message : 'Something went wrong.' }
}

/** POST /api/citizen/session: creates a synthetic profile and sets the session cookie. */
export function createProfile(): Promise<CitizenProfile> {
  return postJson<CitizenProfile>('/api/citizen/session', {})
}

/** GET /api/citizen/receipts. Rejects with ApiClientError 401 SESSION_REQUIRED without a profile. */
export function getReceipts(): Promise<ReceiptsResponse> {
  return getJson<ReceiptsResponse>('/api/citizen/receipts')
}

/** The profile from GET /api/citizen/receipts; null when there is no profile (401). */
export async function getProfile(): Promise<CitizenProfile | null> {
  try {
    return (await getReceipts()).profile
  } catch (err) {
    if (toCitizenError(err).code === 'NO_SESSION') return null
    throw err
  }
}

/** DELETE /api/citizen/session (204). */
export async function deleteProfile(): Promise<void> {
  await requestJson<null>('/api/citizen/session', { method: 'DELETE' })
}

/** One receipt of this profile; null when it is not in the profile. */
export async function findReceipt(eventId: string): Promise<ReceiptOpening | null> {
  const { receipts } = await getReceipts()
  return receipts.find((r) => r.eventId === eventId) ?? null
}

/** Verification always runs in the visitor's browser (never on our server), with the round trip timed here. */
export async function verifyTimed(opening: ReceiptOpening): Promise<VerifyResult> {
  const t0 = performance.now()
  const { verifyReceipt } = await import('./shared/verify')
  const result = await verifyReceipt(opening)
  return { ...result, elapsedMs: Math.round(performance.now() - t0) }
}

/** Request body for POST /api/ai/explain. The server recomputes the verdict itself; only the id is sent. */
export function explainRequestBody(opening: Pick<ReceiptOpening, 'eventId'>, lang: 'en' | 'id' = 'en') {
  return lang === 'id' ? { eventId: opening.eventId, lang } : { eventId: opening.eventId }
}

/** POST /api/ai/explain. Needs the citizen's session cookie; the server only explains its own receipts. */
export async function explain(opening: ReceiptOpening): Promise<ExplainResponse> {
  // The explanation comes back in the language the citizen is reading the app in.
  const wire = await postJson<{ text: string; ai: AiMeta }>('/api/ai/explain', explainRequestBody(opening, getLang()))
  return { text: wire.text, meta: wire.ai }
}

export async function downloadReceiptFile(opening: ReceiptOpening): Promise<void> {
  const { downloadReceipt } = await import('./shared/chain')
  downloadReceipt(opening)
}

/** Opens the share sheet, or copies the proof link where sharing is unsupported. */
export async function shareProof(opening: ReceiptOpening): Promise<'shared' | 'copied'> {
  const url = `${window.location.origin}${proofPath(opening)}`
  if (navigator.share) {
    await navigator.share({ title: 'Saksi proof', url })
    return 'shared'
  }
  await navigator.clipboard.writeText(url)
  return 'copied'
}

// ---- controller ---------------------------------------------------------------------------------

/** Last 10 records of one controller. The route never returns purpose text or full citizen codes. */
export async function getControllerRecent(controllerId: Hex): Promise<RecentAccess[]> {
  const { rows } = await getJson<{ rows: RecentAccessWire[] }>(
    `/api/controller/access/recent?controllerId=${encodeURIComponent(controllerId)}`,
  )
  return rows.map(toRecentAccess).slice(0, 10)
}

const DRAFT_KEYS = ['dataAffected', 'whenAndHow', 'actionsTaken', 'contact'] as const

/**
 * The four parts as far as the model has written them: reads each string value out of incomplete JSON
 * (`{"dataAffected":"Nama, NIK, dan nom`), unescaping what has arrived. Keys not reached yet are left out.
 */
export function partialDraft(text: string): Partial<Pasal46Fields> {
  const out: Partial<Pasal46Fields> = {}
  for (const k of DRAFT_KEYS) {
    const m = new RegExp(`"${k}"\\s*:\\s*"`).exec(text)
    if (!m) continue
    let raw = ''
    for (let i = m.index + m[0].length; i < text.length; i++) {
      const c = text[i]
      if (c === '\\') {
        if (i + 1 >= text.length) break
        raw += c + text[i + 1]
        i++
        continue
      }
      if (c === '"') break
      raw += c
    }
    try {
      out[k] = JSON.parse(`"${raw.replace(/\\u[0-9a-fA-F]{0,3}$/, '')}"`)
    } catch {
      out[k] = raw
    }
  }
  return out
}

/** Why the AI returned nothing: the narrative was not a personal-data incident (a coding request, an unrelated question). */
export const DRAFT_OUT_OF_SCOPE = 'The AI only helps write a personal data breach notice. Describe the incident in your own words.'

/**
 * POST /api/controller/breach/draft/stream: the same draft, streamed. `onPartial` receives the parts as they are written
 * (after a retry it starts again from empty). Resolves with the validated draft, or throws the server's message.
 */
export async function draftBreachStream(
  narrative: string,
  controllerId: Hex,
  onPartial: (fields: Partial<Pasal46Fields>) => void,
): Promise<BreachDraft & { outOfScope?: boolean }> {
  let res: Response
  try {
    res = await fetch('/api/controller/breach/draft/stream', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ controllerId, narrative }),
    })
  } catch {
    throw new ApiClientError(0, 'NETWORK', 'Could not reach the Saksi server. Check your connection.')
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null
    throw new ApiClientError(res.status, body?.error?.code ?? 'HTTP_ERROR', body?.error?.message ?? `The server answered with status ${res.status}.`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let cut: number
    while ((cut = buffer.indexOf('\n\n')) !== -1) {
      const line = buffer.slice(0, cut).trim()
      buffer = buffer.slice(cut + 2)
      if (!line.startsWith('data:')) continue
      const event = JSON.parse(line.slice(5)) as
        | { type: 'delta'; text: string }
        | { type: 'reset' }
        | ({ type: 'done'; outOfScope?: boolean } & DraftWire)
        | { type: 'error'; message: string }
      if (event.type === 'delta') {
        text += event.text
        onPartial(partialDraft(text))
      } else if (event.type === 'reset') {
        text = ''
        onPartial({})
      } else if (event.type === 'error') {
        throw new ApiClientError(503, 'UNAVAILABLE', event.message)
      } else {
        return { ...toBreachDraft(event), ...(event.outOfScope ? { outOfScope: true } : {}) }
      }
    }
  }
  throw new ApiClientError(503, 'UNAVAILABLE', 'The draft stopped before it finished. Try again.')
}

/** POST /api/controller/breach/draft → Pasal 46 fields + AI provenance (provider, model, fallback level). */
export async function draftBreach(narrative: string, controllerId: Hex): Promise<BreachDraft> {
  return toBreachDraft(await postJson<DraftWire>('/api/controller/breach/draft', { controllerId, narrative }))
}

/** Wallet fields the controller screens read (filled from useWalletState in lib/client/wagmi.ts). */
export type WalletState = 'no_wallet' | 'disconnected' | 'wrong_network' | 'not_registered' | 'no_gas' | 'ready'
export type WalletSnapshot = {
  state: WalletState
  isChecking: boolean
  address?: Hex
  controller?: { id: Hex; name: string }
  balance?: bigint
  error: string | null
  isConnecting: boolean
  isSwitching: boolean
}

/** Transaction error as the screens show it. `apiCode` is the API error code (e.g. UNKNOWN_CITIZEN). */
export type TxErrorInfo = { code: string; message: string; apiCode?: string; errorName?: string }
/** The 4 visible transaction steps. */
export type ControllerTxStep = 'preparing' | 'signing' | 'broadcast' | 'confirmed'
/** Same as RecordAccessInput in lib/client/controller.ts. */
export type SealAccessInput = {
  controllerId: Hex
  subjectCode: string
  purposeText: string
  legalBasisKey: LegalBasisKey
  eventType: EventTypeCode
  system?: string
  dataCategories?: readonly DataCategory[]
  operatorRef?: string
}
/** Same as AnchorBreachInput in lib/client/controller.ts. */
export type BreachNoticeInput = {
  controllerId: Hex
  fields: Pasal46Fields
  /** Claimed detection time, unix seconds. */
  detectedAt: number
  affectedCount: number
  aiRunId?: string
}

// ---- regulator ----------------------------------------------------------------------------------

/** GET /api/regulator/breaches: rows plus the total / on time / late counts. */
export function getBreachList(): Promise<BreachListWire> {
  return getJson<BreachListWire>('/api/regulator/breaches')
}

/** GET /api/regulator/breaches/[id]; null when no notice has that id. */
export async function getBreach(id: string): Promise<BreachDetailView | null> {
  let wire: BreachDetailWire
  try {
    wire = await getJson<BreachDetailWire>(`/api/regulator/breaches/${encodeURIComponent(id)}`)
  } catch (err) {
    if (err instanceof ApiClientError && (err.status === 404 || err.status === 400)) return null
    throw err
  }
  return toBreachDetail(wire, (CONTRACTS.BreachNotice as Hex | undefined) ?? null)
}

const watchSeen = new Map<string, { status: WatchRow['status']; changedAt?: number }>()

/** GET /api/watch: Sepolia journal logs compared with the current database. */
export async function getWatchView(controllerId?: Hex): Promise<WatchView> {
  const qs = controllerId ? `?controllerId=${encodeURIComponent(controllerId)}` : ''
  const wire = await getJson<WatchWire>(`/api/watch${qs}`)
  return { rows: toWatchRows(wire.rows, watchSeen, Date.now()), blockNumber: wire.blockNumber, stale: false }
}

function rpcLabel(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'RPC node'
  }
}

/** RPC nodes the visitor can switch between on /proof (host names only; keys in URLs stay hidden). */
export async function getRpcNodes(): Promise<RpcNode[]> {
  const { rpcUrls } = await import('./shared/chain')
  return rpcUrls.map((url, i) => ({ id: String(i), label: rpcLabel(url) }))
}

/** The browser verifier against one chosen RPC node (all configured nodes when the id is unknown). */
export async function verifyOnNode(opening: ReceiptOpening, nodeId: string): Promise<VerifyResult> {
  const t0 = performance.now()
  const [{ createReceiptVerifier, journalAddress, rpcUrls }, { evidenceHash, purposeHash }, { verifyReceipt }] = await Promise.all([
    import('./shared/chain'),
    import('./shared/commit'),
    import('./shared/verify'),
  ])
  const url = rpcUrls[Number(nodeId)]
  const verifier = url && journalAddress ? createReceiptVerifier({ evidenceHash, purposeHash }, { urls: [url], journal: journalAddress }) : verifyReceipt
  const result = await verifier(opening)
  return { ...result, elapsedMs: Math.round(performance.now() - t0) }
}

/**
 * Receipt lookup on /proof. A bare fingerprint (tx hash) carries no receipt details to compare, so
 * this answers null and the screen asks for the full proof link or the downloaded receipt file.
 */
export async function findReceiptByFingerprint(query: string): Promise<ReceiptOpening | null> {
  void query
  return null
}

/**
 * Reads a downloaded receipt file: the `{ chainId, contractAddress, opening }` file written by
 * downloadReceipt (lib/shared/chain.ts), `{ kind: 'saksi-receipt', opening }`, or a bare opening.
 */
export async function readReceiptFile(file: Pick<File, 'text'>): Promise<ReceiptOpening | null> {
  try {
    const value = JSON.parse(await file.text()) as { opening?: unknown } | null
    const c = (value && typeof value === 'object' && 'opening' in value ? value.opening : value) as Partial<ReceiptOpening> | null
    return c && typeof c.eventId === 'string' && typeof c.purposeText === 'string' && typeof c.eventType === 'number'
      ? (c as ReceiptOpening)
      : null
  } catch {
    return null
  }
}

// ── STAGE UI ──
// Projected pitch screen /stage. Counters + live feed come from the public GET /api/stats (built by a
// teammate; contract in riset-ui/27-stage-log.md); Watch counts and the block number from getWatchView().

/** One recent receipt on GET /api/stats. Public: no names, no purpose text, citizen code already masked. */
export type StageRecentWire = {
  id: string
  /** Controller display name, e.g. "Bank Kredit Contoh (fiktif)". */
  controllerName: string
  eventType: EventTypeCode
  /** Masked by the server, e.g. "JV••••". Never the full code. */
  citizenMasked: string
  /** ISO time the access was recorded. */
  createdAt: string
  status: RecordStatus
}

/** GET /api/stats. */
export type StageStatsWire = {
  /** Citizen profiles created (since the last demo reset). */
  citizens: number
  /** Access records with status 'anchored'. */
  receipts: number
  /** ISO time of the newest anchored record; null before the first seal. */
  lastSealAt: string | null
  /** Newest first, at most 8. */
  recent: StageRecentWire[]
}

/** GET /api/stats: public counters + the latest receipts for the stage screen. */
export function getStageStats(): Promise<StageStatsWire> {
  return getJson<StageStatsWire>('/api/stats')
}

// ── CITIZEN UI ──
// View contracts for the citizen "phone turns red" moment (riset-ui/24 §2, riset-ui/28-citizen-log.md).
// The list view only renders these; the auto-verify loop and the "remember seen receipts" store are
// filled in by the container (teammate). No fetching here.

/** Per-row result of the background auto-verify. Absent = not checked yet (row shows its chain status only). */
export type AutoVerdict = 'verifying' | 'match' | 'altered' | 'not_found'

/** Auto-verify results keyed by `ReceiptOpening.eventId`. */
export type AutoVerdicts = Partial<Record<string, AutoVerdict>>

/**
 * A receipt this phone saw earlier that the company's database no longer returns ("DELETED").
 * `opening` is the copy the phone remembered (it still matches the chain, so /proof can re-verify it);
 * `lastSeenAt` is when the phone last saw it in GET /api/citizen/receipts (ms epoch).
 */
export type GhostReceipt = { opening: ReceiptOpening; lastSeenAt: number }

/** eventIds the auto-verify marked ALTERED, in list order. */
export function alteredIds(verdicts: AutoVerdicts | undefined, receipts: Pick<ReceiptOpening, 'eventId'>[]): string[] {
  if (!verdicts) return []
  return receipts.filter((r) => verdicts[r.eventId] === 'altered').map((r) => r.eventId)
}

// ── WATCH VALUE LABELS ──
/** Human label for a Watch db/chain value: event-type and legal-basis codes become their UI labels. */
export function humanWatchValue(value: string): string {
  if (value in EVENT_LABELS) return EVENT_LABELS[value as keyof typeof EVENT_LABELS]
  if (value in LEGAL_BASES) return LEGAL_BASES[value as keyof typeof LEGAL_BASES]
  return value
}

// ---- presenter console (/operator) ---------------------------------------------------------------
// Every call carries the demo admin token in the x-demo-token header. The token lives only in the
// presenter's sessionStorage (app/operator/OperatorConsole.tsx), never in URLs or cookies.

export type { DemoReceipt }
export type TamperAction = 'edit' | 'delete' | 'restore'
type Probe = { ok: boolean; ms: number }
/** GET /api/status. */
export type ServiceStatus = {
  rpc: (Probe & { name: string; block?: number })[]
  db: Probe
  ai: Probe & { model: string | null }
  contracts: { journal: Hex | null; breach: Hex | null; registry: Hex | null }
  configProblems: string[]
}

const demoHeaders = (token: string) => ({ 'x-demo-token': token })

/** GET /api/demo/receipts: recent anchored receipts plus rows the demo deleted (so they can be restored). */
export async function getDemoReceipts(token: string): Promise<DemoReceipt[]> {
  return (await requestJson<{ rows: DemoReceipt[] }>('/api/demo/receipts', { headers: demoHeaders(token) })).rows
}

/**
 * What POST /api/demo/tamper ran (lib/server/tamper.ts): the parameterised SQL text, the non-secret parameters, the
 * changed columns (encrypted ones never decrypted) and the row hashes written to tamper_log.
 */
export type TamperReport = {
  action: TamperAction
  eventId: string
  statement: string
  params: { name: string; value: string }[]
  changes: { field: string; before: string; after: string }[]
  rowHash: { before: string | null; after: string | null }
  log: { id: string; at: string }
}

/** POST /api/demo/tamper. `edit` turns a SHARE_THIRD_PARTY row into READ; `restore` undoes the last edit or delete. */
export function tamperReceipt(token: string, action: TamperAction, eventId: string): Promise<TamperReport> {
  return requestJson('/api/demo/tamper', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...demoHeaders(token) },
    body: JSON.stringify({ action, eventId }),
  })
}

/** GET /api/status: RPC, database and AI probes. The AI probe runs a tiny completion, so call it on demand. */
export function getServiceStatus(token: string): Promise<ServiceStatus> {
  return requestJson<ServiceStatus>('/api/status', { headers: demoHeaders(token) })
}

export const watchKey = (txHash: string | null, logIndex: number | null) => `${txHash?.toLowerCase()}:${logIndex}`
export type WatchSummary = { stats: WatchWire['stats']; blockNumber: number; verdicts: Map<string, WatchRow['status']> }

/** GET /api/watch reduced to the counters and a per-receipt verdict keyed by watchKey(txHash, logIndex). */
export async function getWatchSummary(): Promise<WatchSummary> {
  const wire = await getJson<WatchWire>('/api/watch')
  return {
    stats: wire.stats,
    blockNumber: wire.blockNumber,
    verdicts: new Map(wire.rows.map((row) => [watchKey(row.txHash, row.logIndex), row.status])),
  }
}

// ── REPORTS ──
// Citizen → regulator reports, the regulator's review (signed by the ControllerRegistry admin) and the
// authorised-controllers register. Wire shapes match lib/server/reports.ts and lib/server/controller-register.ts.
export { REPORT_NOTE_MAX, REPORT_REASONS, reviewMessage } from './shared/report-message'
export type { ReportReason, ReportVerdict } from './shared/report-message'
import type { ReportReason, ReportVerdict } from './shared/report-message'

/** Fixed reasons a citizen can give, in the words the citizen sees. */
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  not_me: 'I don’t recognise this access',
  object: 'I object to this use',
  altered: 'My phone found this record changed or deleted',
}

export type ReportInput = {
  eventId: string
  reason: ReportReason
  note?: string | null
  /** Only for a receipt the server no longer returns: the chain position this phone kept. */
  chain?: { txHash: Hex; logIndex: number }
}
export type ReportReceipt = { id: string; status: 'open'; reason: ReportReason; serverVerdict: ReportVerdict; createdAt: string }

export type RegulatorReportWire = {
  id: string
  reason: ReportReason
  note: string | null
  controllerId: string
  controllerName: string
  eventType: 'READ' | 'UPDATE' | 'EXPORT' | 'SHARE_THIRD_PARTY'
  citizenMasked: string
  serverVerdict: ReportVerdict
  status: 'open' | 'reviewed'
  createdAt: string
  sealedAt: number | null
  txHash: string | null
  logIndex: number | null
  reviewedAt: string | null
  reviewedBy: string | null
}
export type RegulatorReportsWire = {
  reports: RegulatorReportWire[]
  counts: { open: number; reviewed: number }
  /** ControllerRegistry admin read from the contract; null when the chain did not answer. */
  admin: string | null
}
export type ReviewResult = { id: string; status: 'open' | 'reviewed'; reviewedAt: string | null; reviewedBy: string | null }

export type ControllerRegisterRow = {
  id: Hex
  name: string
  eoa: Hex
  status: 'active' | 'revoked'
  registeredAt: number | null
  registeredBlock: number
  registrationTx: Hex
  revocationTx: Hex | null
  sealed: number
  /** null when Watch could not reach the chain. */
  altered: number | null
  deleted: number | null
  breachesOnTime: number
  breachesLate: number
  /** null when the reports table is not available. */
  openReports: number | null
  lastActivity: string | null
}
export type ControllerRegisterWire = {
  controllers: ControllerRegisterRow[]
  registry: Hex
  blockNumber: number
  watch: { blockNumber: number; checkedAt: string } | null
  checkedAt: string
}

/** GET /api/citizen/session: always 200, so a first visit can check before asking for receipts. */
export function getSession(): Promise<{ signedIn: boolean; code?: string }> {
  return getJson('/api/citizen/session')
}

/** POST /api/citizen/report: the server re-checks the receipt against the chain and stores its own verdict. */
export function sendReport(input: ReportInput): Promise<ReportReceipt> {
  return postJson<ReportReceipt>('/api/citizen/report', input)
}

/** GET /api/regulator/reports: newest first, citizen codes masked, no purpose text or pseudonyms. */
export function getRegulatorReports(): Promise<RegulatorReportsWire> {
  return getJson<RegulatorReportsWire>('/api/regulator/reports')
}

/** POST /api/regulator/reports/review with the admin's signature over reviewMessage(id, signedAt). */
export function reviewReport(id: string, signedAt: string, signature: Hex): Promise<ReviewResult> {
  return postJson<ReviewResult>('/api/regulator/reports/review', { id, signedAt, signature })
}

/** GET /api/regulator/controllers: every controller registered on chain, with live compliance numbers. */
export function getControllerRegister(): Promise<ControllerRegisterWire> {
  return getJson<ControllerRegisterWire>('/api/regulator/controllers')
}

// ---- controller resolution: which controller ids a wallet may act for -----------------------------

/** One ControllerRegistered or ControllerRevoked log, reduced to what ordering needs. */
export type RegistryLogRef = { controllerId: Hex; blockNumber: bigint; logIndex: number }

const isAfter = (a: RegistryLogRef, b: RegistryLogRef) => a.blockNumber > b.blockNumber || (a.blockNumber === b.blockNumber && a.logIndex > b.logIndex)

/**
 * Candidate controller ids for one wallet, best first. `registered` / `revoked` are the registry logs filtered by the
 * wallet's indexed `eoa`; `registered` is null when the log read failed. Ids whose newest registration was not
 * followed by a revocation come first, newest registration first; the static fallback ids follow (alone when the
 * read failed). The wallet check then picks the first id the contract's isAuthorized confirms, so a stale or
 * incomplete log can never authorize a wallet on its own.
 */
export function controllerCandidates(
  registered: readonly RegistryLogRef[] | null,
  revoked: readonly RegistryLogRef[],
  fallback: readonly Hex[] = DEMO_CONTROLLER_IDS,
): Hex[] {
  const key = (id: Hex) => id.toLowerCase() as Hex
  const latest = new Map<Hex, RegistryLogRef>()
  for (const log of registered ?? []) {
    const seen = latest.get(key(log.controllerId))
    if (!seen || isAfter(log, seen)) latest.set(key(log.controllerId), log)
  }
  const active = [...latest.values()]
    .filter((reg) => !revoked.some((rev) => key(rev.controllerId) === key(reg.controllerId) && isAfter(rev, reg)))
    .sort((a, b) => (isAfter(a, b) ? -1 : 1))
    .map((reg) => key(reg.controllerId))
  return [...active, ...fallback.map(key).filter((id) => !active.includes(id))]
}
