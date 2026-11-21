'use client'

import type { TransactionState } from '@/lib/client/transactions'
import { explorerLink, type ControllerTxStep, type TxErrorInfo } from '@/lib/data'
import { shortHex } from '@/lib/format'
import { Button } from './Button'
import { IconAlert, IconArrowUpRight, IconCheck, IconClock, IconRefresh, IconSpinner } from './icons'

export type StepState = 'done' | 'active' | 'todo' | 'error'
export type Step = { title: string; detail?: string; state: StepState }

/** Vertical 4-step transaction progress (prepare → sign → broadcast → confirm). */
export function TxStepper({ steps, label = 'Transaction progress' }: { steps: Step[]; label?: string }) {
  return (
    <ol aria-label={label} className="relative flex flex-col">
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        const box =
          s.state === 'done'
            ? 'bg-ok text-white border-ok'
            : s.state === 'active'
              ? 'bg-blue text-white border-blue'
              : s.state === 'error'
                ? 'bg-bad text-white border-bad'
                : 'bg-card text-ink-2 border-line-strong'
        return (
          <li key={s.title} className="relative flex gap-3.5 pb-5 last:pb-0" aria-current={s.state === 'active' ? 'step' : undefined}>
            {!last ? (
              <span
                aria-hidden="true"
                className={`absolute left-[13px] top-7 bottom-0 w-px ${s.state === 'done' ? 'bg-ok' : 'bg-line-strong'}`}
              />
            ) : null}
            <span className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border font-mono text-[12px] ${box}`}>
              {s.state === 'done' ? (
                <IconCheck size={15} strokeWidth={2.6} />
              ) : s.state === 'active' ? (
                <IconSpinner size={14} strokeWidth={2.4} />
              ) : s.state === 'error' ? (
                <IconAlert size={14} strokeWidth={2.4} />
              ) : (
                `0${i + 1}`
              )}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className={`block text-[14px] font-medium ${s.state === 'todo' ? 'text-ink-2' : 'text-ink'}`}>
                {s.title}
                <span className="sr-only">
                  {' '}
                  — {s.state === 'done' ? 'done' : s.state === 'active' ? 'in progress' : s.state === 'error' ? 'failed' : 'not started'}
                </span>
              </span>
              {s.detail ? (
                <span className={`mt-0.5 block break-words font-mono text-[12px] ${s.state === 'error' ? 'text-bad' : 'text-ink-2'}`}>
                  {s.detail}
                </span>
              ) : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ---- transaction flow (stepper + error recovery + explorer link) -------------------------------

export type TxPhase = 'idle' | ControllerTxStep | 'error'
export type TxErrorKind = 'rejected' | 'revert' | 'timeout' | 'other'

/** One transaction as the screens show it. Build it from the hook state with txViewFromState(). */
export type TxView = {
  phase: TxPhase
  /** Step that was running when `phase` became 'error'. */
  failedStep?: ControllerTxStep | null
  error?: TxErrorInfo | null
  txHash?: `0x${string}` | null
  blockNumber?: number | bigint | null
  /** Re-confirm request in flight. */
  reconfirming?: boolean
  /** The transaction was sent, so recovery is Re-confirm (never sign again). */
  canReconfirm?: boolean
}

export const TX_IDLE: TxView = { phase: 'idle' }

/** True while a step runs or a re-confirm is in flight (lock buttons, prevent double sends). */
export function isTxBusy(tx: TxView): boolean {
  return tx.phase === 'preparing' || tx.phase === 'signing' || tx.phase === 'broadcast' || Boolean(tx.reconfirming)
}

const ORDER: ControllerTxStep[] = ['preparing', 'signing', 'broadcast', 'confirmed']

/** UI error codes for the hook's TransactionError codes (lib/client/transactions.ts). */
const ERROR_CODE: Record<string, string> = {
  rejected: 'USER_REJECTED',
  reverted: 'TX_REVERTED',
  timeout: 'RPC_TIMEOUT',
  unconfirmed: 'NOT_CONFIRMED',
  nonce: 'NONCE',
  wallet: 'WALLET',
  api: 'API_ERROR',
  unknown: 'TX_FAILED',
}

/**
 * Maps useRecordAccess / useAnchorBreach state (lib/client/controller.ts) onto a TxView:
 * preparing/simulating → preparing, signing → signing, submitting/waiting/confirming → broadcast,
 * anchored → confirmed. `late` (waiting for the late approval) shows as idle: nothing was signed.
 */
export function txViewFromState(state: TransactionState): TxView {
  switch (state.step) {
    case 'idle':
    case 'late':
      return TX_IDLE
    case 'preparing':
    case 'simulating':
      return { phase: 'preparing' }
    case 'signing':
      return { phase: 'signing' }
    case 'submitting':
    case 'waiting':
    case 'confirming':
      return { phase: 'broadcast', txHash: state.txHash }
    case 'anchored':
      return { phase: 'confirmed', txHash: state.txHash }
    case 'failed': {
      const { error, txHash, id } = state
      return {
        phase: 'error',
        failedStep: txHash ? 'broadcast' : id ? 'signing' : 'preparing',
        error: { code: ERROR_CODE[error.code] ?? error.code, message: error.message, ...(error.apiCode ? { apiCode: error.apiCode } : {}) },
        txHash: txHash ?? null,
        canReconfirm: state.canReconfirm,
      }
    }
  }
}

/** Recovery kind for a failed transaction. Anything after the tx was sent is recovered with Re-confirm. */
export function txErrorKind(error: TxErrorInfo | null | undefined, hasHash: boolean): TxErrorKind {
  if (!error) return 'other'
  if (error.code === 'USER_REJECTED') return 'rejected'
  if (error.code === 'CONTRACT_REVERT' || error.code === 'TX_REVERTED' || error.errorName) return 'revert'
  return hasHash ? 'timeout' : 'other'
}

export type TxStepCopy = Record<ControllerTxStep, { title: string; detail: string }>

export const DEFAULT_TX_COPY: TxStepCopy = {
  preparing: { title: 'Prepare record', detail: 'Server builds the fingerprint' },
  signing: { title: 'Sign in MetaMask', detail: 'Your registered wallet signs' },
  broadcast: { title: 'Broadcast', detail: 'Sent to the network, waiting to be mined' },
  confirmed: { title: 'Confirmed', detail: 'On chain · the citizen sees it as RECORDED' },
}

function buildSteps(tx: TxView, copy: TxStepCopy, kind: TxErrorKind): Step[] {
  const active = tx.phase === 'error' ? (tx.failedStep ?? 'preparing') : tx.phase
  const activeIdx = tx.phase === 'idle' ? -1 : ORDER.indexOf(active as ControllerTxStep)
  return ORDER.map((k, i) => {
    let state: StepState = 'todo'
    let detail = copy[k].detail
    if (tx.phase === 'confirmed') state = 'done'
    else if (i < activeIdx) state = 'done'
    else if (i === activeIdx) state = tx.phase === 'error' ? (kind === 'timeout' ? 'active' : 'error') : 'active'
    if (k === 'signing' && state === 'active') detail = 'Waiting for your signature in MetaMask…'
    if (k === 'signing' && state === 'done' && tx.txHash) detail = `Signed · tx ${shortHex(tx.txHash)}`
    if (k === 'broadcast' && state === 'active' && tx.phase !== 'error') detail = 'Usually 12–20 seconds…'
    if (k === 'broadcast' && state === 'active' && kind === 'timeout') detail = 'Not confirmed yet · the network is slow'
    if (k === 'broadcast' && state === 'done' && tx.blockNumber != null) detail = `Mined in block ${Number(tx.blockNumber).toLocaleString('en-US')}`
    if (state === 'error' && tx.error) detail = kind === 'rejected' ? 'Rejected in MetaMask' : kind === 'revert' ? 'Reverted by the contract' : 'Stopped · see below'
    return { title: copy[k].title, detail, state }
  })
}

/**
 * The right-column transaction card: 4 steps, then recovery for the 3 error kinds.
 * - rejected in MetaMask → "Try again" (onRetry)
 * - revert → reason text + "Try again" (onRetry)
 * - timeout → "Re-confirm" (onReconfirm); the tx is already sent, so never sign again.
 */
export function TxFlow({
  tx,
  copy = DEFAULT_TX_COPY,
  onRetry,
  onReconfirm,
}: {
  tx: TxView
  copy?: TxStepCopy
  onRetry?: () => void
  onReconfirm?: () => void
}) {
  const hasHash = Boolean(tx.txHash)
  const kind = tx.phase === 'error' ? txErrorKind(tx.error, hasHash) : 'other'
  const steps = buildSteps(tx, copy, kind)

  return (
    <div className="flex flex-col gap-5">
      <div aria-live="polite">
        <TxStepper steps={steps} />
      </div>

      {tx.phase === 'error' && kind === 'rejected' ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-line bg-paper-2/60 p-4" role="alert">
          <p className="text-[14px] text-ink">
            <strong className="font-semibold">You rejected the signature in MetaMask.</strong> Nothing was sent to the chain.
          </p>
          <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}

      {tx.phase === 'error' && kind === 'revert' ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-bad/30 bg-bad-bg p-4" role="alert">
          <p className="label flex items-center gap-1.5 text-bad">
            <IconAlert size={14} strokeWidth={2.2} /> Reverted{tx.error?.errorName ? ` · ${tx.error.errorName}` : ''}
          </p>
          <p className="text-[14px] leading-relaxed text-ink">{tx.error?.message ?? 'The contract refused this transaction.'}</p>
          <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}

      {tx.phase === 'error' && kind === 'timeout' ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-pending/30 bg-pending-bg p-4" role="alert">
          <p className="label flex items-center gap-1.5 text-pending">
            <IconClock size={14} strokeWidth={2.2} /> Not confirmed yet
          </p>
          <p className="text-[14px] leading-relaxed text-ink">
            The transaction was sent but is not confirmed yet.{' '}
            <strong className="font-semibold">Don’t sign again</strong> — your transaction is already on its way. Re-confirm only
            checks it.
          </p>
          <Button variant="dark" size="sm" arrow loading={tx.reconfirming} disabled={tx.reconfirming} onClick={onReconfirm}>
            {tx.reconfirming ? 'Checking…' : 'Re-confirm'}
          </Button>
        </div>
      ) : null}

      {tx.phase === 'error' && kind === 'other' ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-line bg-paper-2/60 p-4" role="alert">
          <p className="text-[14px] text-ink">{tx.error?.message ?? 'Something went wrong.'}</p>
          <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}

      {tx.txHash ? (
        <a
          href={explorerLink('tx', tx.txHash)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 self-start font-mono text-[13px] text-blue underline-offset-4 hover:underline"
        >
          tx {shortHex(tx.txHash, 10, 6)} <IconArrowUpRight size={13} />
          <span className="sr-only">(opens the block explorer)</span>
        </a>
      ) : null}
    </div>
  )
}
