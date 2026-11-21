'use client'

// Browser-side chain checks shared by every citizen screen. The list checks each sealed receipt in the
// background (one at a time, spaced out) with the same verifier as the "Verify on chain" button, so a
// tampered receipt turns red without a tap, and the detail page shows the same verdict. Nothing here
// trusts the server: verdicts come only from lib/shared/verify.ts talking to public RPC nodes.
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Hex } from 'viem'
import { verifyTimed } from '../data'
import {
  checkable,
  checkDue,
  contentKey,
  hiddenReceipts,
  IDLE,
  type ReceiptCheck,
} from '../receipt-state'
import type { ReceiptOpening, VerifyResult } from '../shared/types'

type State = {
  /** Checks keyed by contentKey(opening): a verdict belongs to the exact content it compared. */
  checks: ReadonlyMap<string, ReceiptCheck>
  /** Sealed receipts (txHash:logIndex) the company no longer shows, confirmed by two scans. */
  hidden: readonly string[]
}

const MAX_ENTRIES = 300
const GAP_MS = 250
const SCAN_EVERY_MS = 20_000

const EMPTY: State = { checks: new Map(), hidden: [] }
let state: State = EMPTY
const listeners = new Set<() => void>()

function emit(next: State) {
  state = next
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Records a check result for this exact receipt content (also used by the manual verify button). */
export function setCheck(opening: ReceiptOpening, check: ReceiptCheck) {
  const checks = new Map(state.checks)
  const key = contentKey(opening)
  checks.delete(key)
  checks.set(key, check)
  while (checks.size > MAX_ENTRIES) checks.delete(checks.keys().next().value as string)
  emit({ ...state, checks })
}

export function checkOf(checks: ReadonlyMap<string, ReceiptCheck>, opening: ReceiptOpening): ReceiptCheck {
  return checks.get(contentKey(opening)) ?? IDLE
}

/** All checks plus the hidden-receipt scan; re-renders when either changes. */
export function useReceiptChecks(): State {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY)
}

/** The current check for one receipt's current content. */
export function useReceiptCheck(opening: ReceiptOpening): ReceiptCheck {
  return checkOf(useReceiptChecks().checks, opening)
}

function vibrate(pattern: number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(pattern)
}

/** Runs the browser verifier on one receipt and stores the result under its content key. */
export async function runCheck(opening: ReceiptOpening): Promise<VerifyResult> {
  const before = checkOf(state.checks, opening)
  setCheck(opening, { phase: 'running' })
  try {
    const result = await verifyTimed(opening)
    setCheck(opening, { phase: 'done', result, at: Date.now() })
    const wasAltered = before.phase === 'done' && before.result.status === 'MISMATCH'
    if (result.status === 'MISMATCH' && !wasAltered) vibrate([40, 60, 40])
    return result
  } catch (e) {
    setCheck(opening, { phase: 'error', error: e instanceof Error ? e.message : 'Verification failed.', at: Date.now() })
    throw e
  }
}

// ---- background pump -----------------------------------------------------------------------------

type Source = { receipts: ReceiptOpening[]; pseudonyms: Hex[] }
const sources = new Set<{ current: Source }>()
let pumping = false
let lastScan = 0
let candidates: string[] = []

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function nextDue(now: number): ReceiptOpening | undefined {
  for (const source of sources) {
    const due = source.current.receipts.find((r) => checkable(r) && checkDue(checkOf(state.checks, r), now))
    if (due) return due
  }
  return undefined
}

async function scanHidden() {
  const all = [...sources].map((s) => s.current)
  const pseudonyms = [...new Set(all.flatMap((s) => s.pseudonyms))]
  const receipts = all.flatMap((s) => s.receipts)
  if (!pseudonyms.length) return
  const { checkCompleteness } = await import('../shared/chain')
  const { missing } = await checkCompleteness(pseudonyms, receipts)
  const next = hiddenReceipts(candidates, missing, receipts)
  candidates = next.candidates
  if (next.confirmed.join() !== state.hidden.join()) {
    if (next.confirmed.length > state.hidden.length) vibrate([40, 60, 40])
    emit({ ...state, hidden: next.confirmed })
  }
}

/** Single-flight loop: checks due receipts one by one, then (rarely) scans the chain for hidden ones. */
async function pump() {
  if (pumping || typeof document === 'undefined' || document.visibilityState === 'hidden') return
  pumping = true
  try {
    const { rpcUrls, journalAddress } = await import('../shared/chain')
    // No public RPC configured (local dev without env): keep the database badges instead of guessing.
    if (!rpcUrls.length || !journalAddress) return
    for (let r = nextDue(Date.now()); r && sources.size; r = nextDue(Date.now())) {
      await runCheck(r).catch(() => undefined)
      await sleep(GAP_MS)
    }
    if (sources.size && Date.now() - lastScan >= SCAN_EVERY_MS) {
      lastScan = Date.now()
      await scanHidden().catch(() => undefined)
    }
  } finally {
    pumping = false
  }
}

/**
 * Checks every sealed receipt in `receipts` against the chain from this browser, re-checking whenever
 * a receipt's database content changes (e.g. the tamper demo). `pseudonyms` (optional) also lets the
 * page notice sealed receipts the company stopped showing.
 */
export function useAutoVerify(receipts: ReceiptOpening[], pseudonyms: Hex[] = []) {
  const source = useRef<Source>({ receipts, pseudonyms })
  const signature = receipts.map(contentKey).join('\n')
  useEffect(() => {
    source.current = { receipts, pseudonyms }
  })
  useEffect(() => {
    const ref = source
    sources.add(ref)
    const id = setInterval(() => void pump(), 3_000)
    const onVisible = () => void pump()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      sources.delete(ref)
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  // A new or edited receipt is checked right away instead of on the next 3 s tick.
  useEffect(() => {
    void pump()
  }, [signature])
}
