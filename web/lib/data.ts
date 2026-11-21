// Data facade for every screen. Every function here calls the real API (app/api/[...path]/route.ts)
// or the browser verifier (lib/shared/verify.ts). Mock data lives in lib/mock.ts and is used only by
// the /dev galleries, which pass their own loaders into the containers.
// Transactions (record access, anchor breach) run through useRecordAccess / useAnchorBreach in
// lib/client/controller.ts; the wallet through useWalletState in lib/client/wagmi.ts.
import { ApiClientError, getJson, postJson, requestJson } from './client/json'
import { CONTRACTS, explorerAddress, explorerTx } from './env'
import { proofPath } from './format'
import { controllerId as controllerIdOf } from './shared/commit'
import type {
  AiMeta,
  BreachRow,
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
 * Controllers registered by contracts/script/Deploy.s.sol: keccak256("ctrl:" + slug).
 * useWalletState checks the connected wallet against these ids in ControllerRegistry.
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
export function explainRequestBody(opening: Pick<ReceiptOpening, 'eventId'>) {
  return { eventId: opening.eventId }
}

/** POST /api/ai/explain. Needs the citizen's session cookie; the server only explains its own receipts. */
export async function explain(opening: ReceiptOpening): Promise<ExplainResponse> {
  const wire = await postJson<{ text: string; ai: AiMeta }>('/api/ai/explain', explainRequestBody(opening))
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
  /** Controller display name, e.g. "Demo One". */
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

/** POST /api/demo/tamper. `edit` turns a SHARE_THIRD_PARTY row into READ; `restore` undoes the last edit or delete. */
export function tamperReceipt(token: string, action: TamperAction, eventId: string): Promise<{ action: TamperAction; eventId: string }> {
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
