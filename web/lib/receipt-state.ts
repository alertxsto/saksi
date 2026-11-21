// One mapping from "what the database says" + "what this browser's chain check found" to what every
// receipt screen shows (badge, headline, flagged ledger rows). Pure: no React, no network, so the
// list, the detail page and /proof cannot drift apart, and vitest covers every state.
import { actSentence } from './format'
import { EVENT_TYPES, type ReceiptOpening, type VerifyResult } from './shared/types'

/** Result of the in-browser chain check for one receipt, as the screens see it. */
export type ReceiptCheck =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'done'; result: VerifyResult; at: number }
  | { phase: 'error'; error: string; at: number }

export const IDLE: ReceiptCheck = { phase: 'idle' }

/** Badge kinds a receipt can show (a subset of Badge's StatusKind). */
export type ReceiptStateKind = 'RECORDED' | 'ON_CHAIN' | 'FAILED' | 'CHECKING' | 'MATCH' | 'ALTERED' | 'NOT_FOUND'

type MismatchField = VerifyResult['mismatches'][number]['field']

/** What the database row claims, before any chain check. */
export function recordKind(status: ReceiptOpening['status']): ReceiptStateKind {
  return status === 'anchored' ? 'RECORDED' : status === 'failed' ? 'FAILED' : 'ON_CHAIN'
}

/**
 * The one badge for a receipt. A chain verdict overrides the database's own claim:
 * MATCH stays green, ALTERED turns red whatever the row says. NOT_FOUND only replaces RECORDED
 * (a pending or failed receipt is expected to be missing on chain). A failed check decides nothing.
 */
export function receiptKind(opening: Pick<ReceiptOpening, 'status'>, check: ReceiptCheck): ReceiptStateKind {
  const base = recordKind(opening.status)
  if (check.phase === 'running') return 'CHECKING'
  if (check.phase !== 'done') return base
  if (check.result.status === 'MATCH') return 'MATCH'
  if (check.result.status === 'MISMATCH') return 'ALTERED'
  return base === 'RECORDED' ? 'NOT_FOUND' : base
}

/**
 * The chain's verdict alone, ignoring what the record claims about itself. For receipts opened from an
 * untrusted link (/proof): null until this browser has checked, then CHECKING / MATCH / ALTERED / NOT_FOUND.
 */
export function verdictKind(check: ReceiptCheck): Extract<ReceiptStateKind, 'CHECKING' | 'MATCH' | 'ALTERED' | 'NOT_FOUND'> | null {
  if (check.phase === 'running') return 'CHECKING'
  if (check.phase !== 'done') return null
  return check.result.status === 'MATCH' ? 'MATCH' : check.result.status === 'MISMATCH' ? 'ALTERED' : 'NOT_FOUND'
}

/** Fields the chain check found changed; empty unless the verdict is ALTERED. */
export function alteredFields(check: ReceiptCheck): ReadonlySet<MismatchField> {
  if (check.phase !== 'done' || check.result.status !== 'MISMATCH') return new Set()
  return new Set(check.result.mismatches.map((m) => m.field))
}

/** The event type the chain sealed, when the check proved the database's event type wrong. */
export function sealedEventType(check: ReceiptCheck): number | null {
  if (check.phase !== 'done' || check.result.status !== 'MISMATCH') return null
  const m = check.result.mismatches.find((x) => x.field === 'eventType')
  const index = m ? (EVENT_TYPES as readonly string[]).indexOf(m.chain) : -1
  return index >= 0 ? index : null
}

/** True when the check proved the controller id in the database differs from the sealed one. */
export function controllerAltered(opening: Pick<ReceiptOpening, 'controllerId'>, check: ReceiptCheck): boolean {
  if (check.phase !== 'done' || check.result.status !== 'MISMATCH') return false
  return check.result.mismatches.some((m) => m.field === 'contract' && m.db.toLowerCase() === opening.controllerId.toLowerCase())
}

export type ReceiptHeadline = {
  who: string
  /** Event type code behind `act` (the sealed one when the chain proved the database wrong). */
  eventType: number
  /** What happened, from the most trustworthy source available. */
  act: string
  /** 'chain' when the database's event type was proven wrong and `act` is what the chain sealed. */
  source: 'record' | 'chain'
  /** The database's (altered) version of `act`, only when source is 'chain'. */
  claimed: string | null
  kind: ReceiptStateKind
}

/** Headline for a receipt: never repeats an event type the chain has just proven false. */
export function receiptHeadline(opening: ReceiptOpening, check: ReceiptCheck): ReceiptHeadline {
  const who = opening.controllerName.replace(' (fictional)', '')
  const kind = receiptKind(opening, check)
  const sealed = sealedEventType(check)
  if (sealed !== null && sealed !== opening.eventType) {
    return { who, eventType: sealed, act: actSentence(sealed), source: 'chain', claimed: actSentence(opening.eventType), kind }
  }
  return { who, eventType: opening.eventType, act: actSentence(opening.eventType), source: 'record', claimed: null, kind }
}

/** Short line under a headline that names where the truth came from. Null before any verdict. */
export function verdictNote(kind: ReceiptStateKind): string | null {
  switch (kind) {
    case 'MATCH':
      return 'Matches the chain · checked by your phone'
    case 'ALTERED':
      return 'Altered · the database no longer matches the chain'
    case 'NOT_FOUND':
      return 'Not found on this node yet · not proof of tampering'
    case 'CHECKING':
      return 'Checking the chain…'
    default:
      return null
  }
}

// ---- background checks ------------------------------------------------------------------------

/**
 * Identity of what the database currently says about a receipt. A check is valid only for the exact
 * content it compared, so any edit to the row (the tamper demo flips event_type) needs a new check.
 */
export function contentKey(o: ReceiptOpening): string {
  return JSON.stringify([
    o.eventId,
    o.controllerId,
    o.subjectPseudonym,
    o.purposeText,
    o.purposeSalt,
    o.legalBasisKey,
    o.eventType,
    o.evidence,
    o.txHash,
    o.logIndex,
  ])
}

export const RETRY_NOT_FOUND_MS = 6_000
export const RETRY_ERROR_MS = 15_000

/** Only sealed receipts with a transaction can be checked in the background. */
export function checkable(o: Pick<ReceiptOpening, 'status' | 'txHash' | 'logIndex'>): boolean {
  return o.status === 'anchored' && !!o.txHash && o.logIndex !== null
}

/**
 * Whether a background check should run now. MATCH and ALTERED are final for a given content key
 * (the chain does not change); a node that did not have the record yet, or a failed request, retries.
 */
export function checkDue(check: ReceiptCheck, now: number): boolean {
  switch (check.phase) {
    case 'idle':
      return true
    case 'running':
      return false
    case 'error':
      return now - check.at >= RETRY_ERROR_MS
    case 'done':
      return check.result.status === 'NOT_FOUND' && now - check.at >= RETRY_NOT_FOUND_MS
  }
}

export type ChainLogRef = { txHash: string; logIndex: number }

/**
 * Sealed receipts for this citizen that the company no longer shows (row deleted or hidden).
 * A log only counts once two consecutive scans miss it, and never while any shown receipt carries its
 * transaction, so a receipt that is still being confirmed is not reported.
 */
export function hiddenReceipts(
  previous: readonly string[],
  found: readonly ChainLogRef[],
  shown: readonly Pick<ReceiptOpening, 'txHash'>[],
): { candidates: string[]; confirmed: string[] } {
  const shownTx = new Set(shown.flatMap((r) => (r.txHash ? [r.txHash.toLowerCase()] : [])))
  const candidates = found
    .filter((log) => !shownTx.has(log.txHash.toLowerCase()))
    .map((log) => `${log.txHash.toLowerCase()}:${log.logIndex}`)
  const before = new Set(previous)
  return { candidates, confirmed: candidates.filter((key) => before.has(key)) }
}
