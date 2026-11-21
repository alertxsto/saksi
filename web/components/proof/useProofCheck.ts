'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReceiptCheck } from '@/lib/receipt-state'
import type { VerifyResult } from '@/lib/shared/types'

/**
 * The four public steps of a check. The chain call itself is one request (lib/shared/chain verifyReceipt):
 * step 1 is local, step 2 waits on the node, steps 3–4 happen inside the same verifier and are only shown
 * once its answer is in. Each step holds for at least STEP_MS so the sequence can be read.
 */
export const PROOF_STEPS = ['read', 'ask', 'hash', 'compare'] as const
export type ProofStepId = (typeof PROOF_STEPS)[number]
export type StepState = 'todo' | 'active' | 'done' | 'fail' | 'skip'

const STEP_MS = 320

export type ProofCheck = {
  /** idle → running (stepper ticking) → done | error. The verdict is only exposed once the stepper ends. */
  phase: 'idle' | 'running' | 'done' | 'error'
  /** How many steps have finished (0–4). */
  ticked: number
  result: VerifyResult | null
  error: string | null
  start: () => void
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

const wait = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve())

/**
 * Same contract as VerifyPanel (components/ui/VerifyResult): `run` does the check, the round trip is measured
 * here, MISMATCH vibrates, every phase change is reported through `onCheck` (once the verdict is shown).
 */
export function useProofCheck({
  run,
  autoStart,
  onCheck,
}: {
  run: (attempt: number) => Promise<VerifyResult>
  autoStart?: boolean
  onCheck?: (check: ReceiptCheck) => void
}): ProofCheck {
  const [phase, setPhase] = useState<ProofCheck['phase']>('idle')
  const [ticked, setTicked] = useState(0)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const attempt = useRef(0)
  const started = useRef(false)
  const alive = useRef(true)
  const onCheckRef = useRef(onCheck)
  const runRef = useRef(run)
  useEffect(() => {
    onCheckRef.current = onCheck
    runRef.current = run
  })
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const start = useCallback(async () => {
    const mine = ++attempt.current
    const step = reducedMotion() ? 0 : STEP_MS
    const current = () => alive.current && attempt.current === mine
    setPhase('running')
    setResult(null)
    setError(null)
    setTicked(0)
    onCheckRef.current?.({ phase: 'running' })
    const t0 = performance.now()
    const call = runRef.current(mine).then(
      (r) => ({ ok: true as const, r: { ...r, elapsedMs: Math.round(performance.now() - t0) } }),
      (e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : 'Verification failed. Check your connection.' }),
    )
    // 1 · read the receipt (local)
    await wait(step)
    if (!current()) return
    setTicked(1)
    // 2 · ask the public ledger (real network wait, at least one step long)
    const [answer] = await Promise.all([call, wait(step)])
    if (!current()) return
    if (!answer.ok) {
      setError(answer.message)
      setPhase('error')
      onCheckRef.current?.({ phase: 'error', error: answer.message, at: Date.now() })
      return
    }
    const r = answer.r
    setResult(r)
    if (r.status === 'NOT_FOUND') {
      setTicked(PROOF_STEPS.length)
      setPhase('done')
      onCheckRef.current?.({ phase: 'done', result: r, at: Date.now() })
      return
    }
    setTicked(2)
    // 3 · recompute the fingerprint, 4 · compare every field
    await wait(step)
    if (!current()) return
    setTicked(3)
    await wait(step)
    if (!current()) return
    setTicked(4)
    setPhase('done')
    onCheckRef.current?.({ phase: 'done', result: r, at: Date.now() })
    if (r.status === 'MISMATCH' && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([40, 60, 40])
  }, [])

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true
      void start()
    }
  }, [autoStart, start])

  return { phase, ticked, result, error, start: () => void start() }
}

/** The display state of each step from the check's progress. */
export function stepStates(check: Pick<ProofCheck, 'phase' | 'ticked' | 'result'>): Record<ProofStepId, StepState> {
  const out = {} as Record<ProofStepId, StepState>
  const notFound = check.result?.status === 'NOT_FOUND'
  const bad = check.result?.status === 'MISMATCH'
  PROOF_STEPS.forEach((id, i) => {
    if (check.phase === 'idle') out[id] = 'todo'
    else if (check.phase === 'error') out[id] = i < check.ticked ? 'done' : i === check.ticked ? 'fail' : 'skip'
    else if (notFound) out[id] = i === 0 ? 'done' : i === 1 ? 'fail' : 'skip'
    else if (i < check.ticked) out[id] = bad && id === 'compare' ? 'fail' : 'done'
    else if (i === check.ticked && check.phase === 'running') out[id] = 'active'
    else out[id] = 'todo'
  })
  return out
}
