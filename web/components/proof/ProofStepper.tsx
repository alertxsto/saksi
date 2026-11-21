'use client'

import type { ReceiptOpening, VerifyResult } from '@/lib/shared/types'
import { PROOF_STEPS, stepStates, type ProofCheck, type ProofStepId, type StepState } from './useProofCheck'
import './proof.css'

const TITLE: Record<ProofStepId, string> = {
  read: 'Read the receipt',
  ask: 'Ask the public ledger',
  hash: 'Recompute the fingerprint',
  compare: 'Compare every field',
}

const FIELDS = 6

/** Full host name of an RPC URL ("ethereum-sepolia-rpc.publicnode.com"); keys in paths stay hidden. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function meta(id: ProofStepId, state: StepState, opening: ReceiptOpening, result: VerifyResult | null, node: string): string {
  if (id === 'read') return state === 'todo' ? 'From the link or file you opened' : `${opening.controllerName.replace(' (fictional)', '')} · ${FIELDS} fields`
  if (id === 'ask') {
    if (state === 'active') return `Asking ${node}…`
    if (state === 'fail') return result?.status === 'NOT_FOUND' ? `${(result.rpc && hostOf(result.rpc)) || node} has no entry for it yet` : `${node} did not answer`
    if (state === 'done') return `Sealed entry found · ${(result?.rpc && hostOf(result.rpc)) || node}`
    return node
  }
  if (id === 'hash') {
    if (state === 'done') return 'Purpose and evidence hashed in this browser'
    if (state === 'skip') return 'Nothing to compare yet'
    return 'Hashed here, never sent anywhere'
  }
  if (state === 'done') return `All ${FIELDS} fields match`
  if (state === 'fail' && result?.status === 'MISMATCH') {
    const n = result.mismatches.length
    return `${n} field${n === 1 ? '' : 's'} changed after sealing`
  }
  if (state === 'skip') return 'Nothing to compare yet'
  return 'Agency, action, purpose, legal basis, evidence, citizen'
}

function Mark({ state, n }: { state: StepState; n: number }) {
  const base = 'pf-mark relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold tnum'
  if (state === 'done')
    return (
      <span className={`${base} border-ink bg-ink text-paper`}>
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <path className="pf-draw" d="M3.5 8.4 6.6 11.4 12.6 4.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  if (state === 'fail')
    return (
      <span className={`${base} border-bad bg-bad text-white`}>
        <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true">
          <path className="pf-draw" d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
    )
  if (state === 'active')
    return (
      <span className={`${base} border-blue bg-card text-blue`}>
        <span className="size-2 rounded-full bg-blue" />
      </span>
    )
  return <span className={`${base} ${state === 'skip' ? 'border-dashed border-line-strong text-ink-3' : 'border-line-strong bg-card text-ink-3'}`}>{n}</span>
}

/**
 * The public check as a vertical stepper (riset-ui/37 §5.3): read the receipt → ask the public ledger →
 * recompute the fingerprint → compare every field. Steps tick in order with a drawn check; a NOT FOUND stops
 * at step 2 in grey wording ("not proof of tampering"), an ALTERED result fails the last step in red.
 */
export function ProofStepper({
  check,
  opening,
  node,
}: {
  check: Pick<ProofCheck, 'phase' | 'ticked' | 'result' | 'error'>
  opening: ReceiptOpening
  /** Host name of the node this browser is asking. */
  node: string
}) {
  const states = stepStates(check)
  const notFound = check.result?.status === 'NOT_FOUND'
  return (
    <ol aria-label="Verification steps" className="flex flex-col">
      {PROOF_STEPS.map((id, i) => {
        const s = states[id]
        // NOT FOUND is not a tamper signal: the failed lookup reads grey, not red.
        const grey = (notFound || check.phase === 'error') && s === 'fail'
        const text = meta(id, s, opening, check.result, node)
        const last = i === PROOF_STEPS.length - 1
        return (
          <li key={id} className={`relative flex gap-3.5 ${last ? '' : 'pb-5'}`} aria-current={s === 'active' ? 'step' : undefined}>
            {!last ? <span aria-hidden="true" className="pf-rail" data-on={s === 'done' ? '' : undefined} /> : null}
            {grey ? (
              <span className="pf-mark relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border border-unknown bg-unknown-bg text-unknown">
                <span className="h-[2px] w-2.5 rounded-full bg-current" />
              </span>
            ) : (
              <Mark state={s} n={i + 1} />
            )}
            <div className="min-w-0 flex-1 pt-[3px]">
              <p
                className={`text-[15px] font-medium leading-snug transition-colors duration-200 ${
                  s === 'todo' || s === 'skip' ? 'text-ink-3' : s === 'fail' && !grey ? 'text-bad' : 'text-ink'
                }`}
              >
                {TITLE[id]}
                <span className="sr-only">
                  {' '}
                  — {s === 'done' ? 'done' : s === 'active' ? 'in progress' : s === 'fail' ? (grey ? 'not found' : 'failed') : s === 'skip' ? 'skipped' : 'waiting'}
                </span>
              </p>
              <p
                key={`${id}-${s}`}
                className={`pf-fade mt-0.5 break-words text-[13px] leading-snug ${
                  s === 'fail' && !grey ? 'text-bad' : id === 'ask' ? 'font-mono text-[12px] text-ink-3' : 'text-ink-3'
                }`}
              >
                {text}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
