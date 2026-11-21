'use client'

import type { TransactionState } from '@/lib/client/transactions'
import { explorerLink, type ControllerTxStep, type TxErrorInfo } from '@/lib/data'
import { shortHex } from '@/lib/format'
import { Button } from './Button'
import { DotoValue } from './DotoValue'
import { IconArrowUpRight, IconCheck, IconClock, IconMinus, IconRefresh, IconSpinner } from './icons'

export type StepState = 'done' | 'active' | 'todo' | 'error'
export type Step = { title: string; detail?: string; state: StepState; /** amber instead of neutral for an error/waiting step */ warn?: boolean }

/** Colour set for the two surfaces: paper (working state) and vault (the seal-confirmed moment). */
const T = {
  paper: {
    line: 'border-line',
    ink: 'text-ink',
    ink2: 'text-ink-2',
    done: 'bg-ok text-white',
    active: 'border border-blue text-blue',
    warn: 'border border-pending text-pending',
    stop: 'border border-line-strong text-ink-2',
    todo: 'border border-line text-ink-3',
    warnText: 'text-pending',
    link: 'text-blue',
    btn: 'light' as const,
  },
  vault: {
    line: 'border-vault-line',
    ink: 'text-vault-ink',
    ink2: 'text-vault-ink-2',
    done: 'bg-ice text-vault',
    active: 'border border-ice text-ice',
    warn: 'border border-pending-v text-pending-v',
    stop: 'border border-vault-ink-2 text-vault-ink-2',
    todo: 'border border-vault-line text-vault-ink-2',
    warnText: 'text-pending-v',
    link: 'text-ice',
    btn: 'vault' as const,
  },
}

/**
 * Vertical 4-step transaction progress (prepare → sign → broadcast → confirm): a quiet ✓ row per finished
 * step, a spinner on the running one, future steps grey (Mobbin K4, Midjourney). Paper by default.
 */
export function TxStepper({ steps, label = 'Transaction progress', onVault = false }: { steps: Step[]; label?: string; onVault?: boolean }) {
  const t = onVault ? T.vault : T.paper
  return (
    <ol aria-label={label} className="flex flex-col">
      {steps.map((s, i) => {
        const marker =
          s.state === 'done' ? t.done : s.state === 'active' ? (s.warn ? t.warn : t.active) : s.state === 'error' ? (s.warn ? t.warn : t.stop) : t.todo
        return (
          <li
            key={s.title}
            className={`flex items-start gap-3.5 border-t py-3 first:border-t-0 first:pt-0 last:pb-0 ${t.line}`}
            aria-current={s.state === 'active' ? 'step' : undefined}
          >
            <span className={`mt-px flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] transition-colors duration-300 ${marker}`}>
              {s.state === 'done' ? (
                <IconCheck key="d" size={13} strokeWidth={2.8} className="ctl-stamp" />
              ) : s.state === 'active' ? (
                s.warn ? <IconClock size={13} strokeWidth={2.4} /> : <IconSpinner size={13} strokeWidth={2.4} />
              ) : s.state === 'error' ? (
                s.warn ? <IconClock size={13} strokeWidth={2.4} /> : <IconMinus size={13} strokeWidth={2.6} />
              ) : (
                i + 1
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-[15px] font-medium leading-snug ${s.state === 'todo' ? t.ink2 : t.ink}`}>
                {s.title}
                <span className="sr-only">
                  {' '}
                  — {s.state === 'done' ? 'done' : s.state === 'active' ? 'in progress' : s.state === 'error' ? 'stopped' : 'not started'}
                </span>
              </span>
              {s.detail ? (
                <span className={`mt-0.5 block break-words font-mono text-[12px] ${s.warn && s.state !== 'todo' ? t.warnText : t.ink2}`}>{s.detail}</span>
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

export function buildSteps(tx: TxView, copy: TxStepCopy = DEFAULT_TX_COPY): Step[] {
  const kind = tx.phase === 'error' ? txErrorKind(tx.error, Boolean(tx.txHash)) : 'other'
  const active = tx.phase === 'error' ? (tx.failedStep ?? 'preparing') : tx.phase
  const activeIdx = tx.phase === 'idle' ? -1 : ORDER.indexOf(active as ControllerTxStep)
  return ORDER.map((k, i) => {
    let state: StepState = 'todo'
    let detail = copy[k].detail
    let warn = false
    if (tx.phase === 'confirmed') state = 'done'
    else if (i < activeIdx) state = 'done'
    else if (i === activeIdx) state = tx.phase === 'error' ? (kind === 'timeout' ? 'active' : 'error') : 'active'
    if (k === 'signing' && state === 'active') detail = 'Waiting for your signature in MetaMask…'
    if (k === 'signing' && state === 'done' && tx.txHash) detail = `Signed · tx ${shortHex(tx.txHash)}`
    if (k === 'broadcast' && state === 'active' && tx.phase !== 'error') detail = 'Usually 12–20 seconds…'
    if (k === 'broadcast' && state === 'active' && kind === 'timeout') {
      detail = 'Not confirmed yet · the network is slow'
      warn = true
    }
    if (k === 'broadcast' && state === 'done' && tx.blockNumber != null) detail = `Mined in block ${Number(tx.blockNumber).toLocaleString('en-US')}`
    if (state === 'error' && tx.error) detail = kind === 'rejected' ? 'Rejected in MetaMask' : kind === 'revert' ? 'Reverted by the contract' : 'Stopped · see below'
    return { title: copy[k].title, detail, state, warn }
  })
}

/** One-line headline for the chamber: what is happening right now. */
export function txHeadline(tx: TxView): { title: string; tone: 'idle' | 'live' | 'done' | 'warn' | 'stopped' } {
  const kind = tx.phase === 'error' ? txErrorKind(tx.error, Boolean(tx.txHash)) : 'other'
  switch (tx.phase) {
    case 'idle':
      return { title: 'Nothing sealed yet', tone: 'idle' }
    case 'preparing':
      return { title: 'Fingerprinting the record', tone: 'live' }
    case 'signing':
      return { title: 'Waiting for your signature', tone: 'live' }
    case 'broadcast':
      return { title: 'On its way to the chain', tone: 'live' }
    case 'confirmed':
      return { title: 'Sealed on chain', tone: 'done' }
    case 'error':
      return kind === 'timeout'
        ? { title: tx.reconfirming ? 'Checking the chain again…' : 'Sent · not confirmed yet', tone: 'warn' }
        : kind === 'rejected'
          ? { title: 'Rejected in MetaMask', tone: 'stopped' }
          : kind === 'revert'
            ? { title: 'Refused by the contract', tone: 'stopped' }
            : { title: 'Stopped before sealing', tone: 'stopped' }
  }
}

/** Big Doto block number for the seal-confirmed moment (only when the hook reports one). */
export function TxBlock({ blockNumber }: { blockNumber?: number | bigint | null }) {
  if (blockNumber == null) return null
  return (
    <p className="flex flex-col gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-vault-ink-2">Mined in block</span>
      <span className="text-[40px] leading-none text-vault-ink">
        <DotoValue value={String(Number(blockNumber))} />
      </span>
    </p>
  )
}

/** Human copy for a contract revert reason. Unknown names fall back to a plain sentence, never the identifier. */
const REVERT_COPY: Record<string, string> = {
  ControllerNotActive: 'Your controller registration is not active',
  NotController: 'This wallet is not a registered controller',
  ClaimedWindowExpired: 'The 72-hour window has passed',
  AlreadyAnchored: 'This was already sealed',
}
export function revertReason(errorName?: string): string {
  return (errorName && REVERT_COPY[errorName]) || 'The contract refused this transaction'
}

/**
 * The transaction progression: 4 steps, then recovery for the 3 error kinds.
 * - rejected in MetaMask → "Try again" (onRetry)
 * - revert → reason text + "Try again" (onRetry)
 * - timeout → "Re-confirm" (onReconfirm); the tx is already sent, so never sign again.
 * No red: a refused or unconfirmed transaction is not tampering (amber = waiting, grey = stopped).
 */
export function TxFlow({
  tx,
  copy = DEFAULT_TX_COPY,
  onRetry,
  onReconfirm,
  onVault = false,
}: {
  tx: TxView
  copy?: TxStepCopy
  onRetry?: () => void
  onReconfirm?: () => void
  /** Draw on the dark vault surface (the seal-confirmed moment). */
  onVault?: boolean
}) {
  const t = onVault ? T.vault : T.paper
  const hasHash = Boolean(tx.txHash)
  const kind = tx.phase === 'error' ? txErrorKind(tx.error, hasHash) : 'other'
  const steps = buildSteps(tx, copy)
  const block = `ctl-in flex flex-col items-start gap-3 border-t pt-4 ${t.line}`

  return (
    <div className="flex flex-col gap-5">
      <div aria-live="polite">
        <TxStepper steps={steps} onVault={onVault} />
      </div>

      {tx.phase === 'error' && kind === 'rejected' ? (
        <div key="rejected" className={block} role="alert">
          <p className={`text-[14px] leading-relaxed ${t.ink}`}>
            <strong className="font-semibold">You rejected the signature in MetaMask.</strong>{' '}
            <span className={t.ink2}>Nothing was sent to the chain.</span>
          </p>
          <Button variant={t.btn} size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}

      {tx.phase === 'error' && kind === 'revert' ? (
        <div key="revert" className={block} role="alert">
          {/* raw contract error names stay out of the copy; the code is kept in the tooltip for support */}
          <p className={`text-[14px] font-medium ${t.ink}`} title={tx.error?.errorName ? `Contract: ${tx.error.errorName}` : undefined}>
            {revertReason(tx.error?.errorName)}
          </p>
          <p className={`text-[14px] leading-relaxed ${t.ink2}`}>{tx.error?.message ?? 'The contract refused this transaction.'}</p>
          <Button variant={t.btn} size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}

      {tx.phase === 'error' && kind === 'timeout' ? (
        <div key="timeout" className={block} role="alert">
          <p className={`flex items-center gap-1.5 font-mono text-[12px] ${t.warnText}`}>
            <IconClock size={13} strokeWidth={2.2} /> Not confirmed yet
          </p>
          <p className={`text-[14px] leading-relaxed ${t.ink2}`}>
            The transaction was sent but is not confirmed yet.{' '}
            <strong className={`font-semibold ${t.ink}`}>Don’t sign again</strong>: it is already on its way. Re-confirm only checks it.
          </p>
          <Button variant={onVault ? 'vault' : 'dark'} size="sm" arrow loading={tx.reconfirming} disabled={tx.reconfirming} onClick={onReconfirm}>
            {tx.reconfirming ? 'Checking…' : 'Re-confirm'}
          </Button>
        </div>
      ) : null}

      {tx.phase === 'error' && kind === 'other' ? (
        <div key="other" className={block} role="alert">
          <p className={`text-[14px] leading-relaxed ${t.ink}`}>{tx.error?.message ?? 'Something went wrong.'}</p>
          <Button variant={t.btn} size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}

      {tx.txHash ? (
        <a
          href={explorerLink('tx', tx.txHash)}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center gap-1.5 self-start font-mono text-[13px] underline-offset-4 hover:underline ${t.link}`}
        >
          tx {shortHex(tx.txHash, 10, 6)} <IconArrowUpRight size={13} />
          <span className="sr-only">(opens the block explorer)</span>
        </a>
      ) : null}
    </div>
  )
}
