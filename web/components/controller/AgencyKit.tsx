'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { stringToHex } from 'viem'
import { VerdictStamp } from '@/components/citizen/VerdictStamp'
import { initials } from '@/components/citizen/ReceiptRows'
import { Button, ButtonLink } from '@/components/ui/Button'
import { IconAlert, IconArrowUpRight, IconCheck, IconChevronRight, IconCopy, IconRefresh, IconShield, IconWallet } from './agency-icons'
import { buildSteps, revertReason, txErrorKind, type TxView } from '@/components/ui/TxStepper'
import { CHAIN_NAME, FAUCET_URL, formatEth, METAMASK_URL, WalletChecks, type WalletView } from '@/components/ui/WalletGate'
import { explorerLink } from '@/lib/data'
import { basisKeyFromHex, formatWIB, shortHex } from '@/lib/format'
import {
  DATA_CATEGORY_LABELS,
  LEGAL_BASES,
  type DataCategory,
  type EventTypeCode,
  type LegalBasisKey,
} from '@/lib/shared/types'
import '@/app/citizen/stub-ticket.css'
import '@/app/controller/agency.css'

/** Same words as the citizen's receipt (ReceiptDetail): the agency copy reads exactly what the phone shows. */
export const VERB = ['Read', 'Updated', 'Exported', 'Shared'] as const
export const TAIL = ['your data', 'your data', 'your data', 'your data with a third party'] as const

/** Page header (riset-ui/37 §4): title 28/600, one line of description, primary action on the right. */
export function AgencyPageHead({ title, description, action }: { title: string; description: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 pb-6 lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:pb-8">
      <div className="min-w-0">
        <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink lg:text-[28px] lg:tracking-[-0.02em]">{title}</h1>
        <p className="mt-1.5 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  )
}

/** The only place chain data lives: a collapsed "Technical proof" disclosure (riset-ui/37 §2). */
export function TechProof({ rows, label = 'Technical proof' }: { rows: Array<[string, ReactNode]>; label?: string }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== '')
  if (!shown.length) return null
  return (
    <details className="ag-proof group">
      <summary className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-1 text-[13px] text-ink-2 transition-colors duration-150 hover:text-ink">
        <IconChevronRight size={14} className="ag-proof-chev" />
        {label}
      </summary>
      <dl className="mt-1 overflow-hidden rounded-[12px] bg-paper-2/60">
        {shown.map(([k, v], i) => (
          <div key={k} className={`flex min-w-0 items-center justify-between gap-4 px-3.5 py-2.5 ${i ? 'border-t border-line/70' : ''}`}>
            <dt className="shrink-0 text-[13px] text-ink-2">{k}</dt>
            <dd className="min-w-0 truncate text-right font-mono text-[13px] text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

export function TxLink({ hash }: { hash: string }) {
  return (
    <a href={explorerLink('tx', hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue underline-offset-4 hover:underline">
      {shortHex(hash, 8, 6)} <IconArrowUpRight size={12} />
      <span className="sr-only">(opens the block explorer)</span>
    </a>
  )
}

/**
 * The agency's seal: same geometry and landing as the citizen's VerdictStamp (st-stamp from stub-ticket.css), in
 * agency blue, reading what is true for this side: the record is sealed and Saksi witnessed it.
 */
export function SealStamp({ size = 104, tone = 'blue', text = 'SEALED · WITNESSED BY SAKSI · SEALED ·' }: { size?: number; tone?: 'blue' | 'ok' | 'pending'; text?: string }) {
  const id = useId().replace(/:/g, '')
  const t = 48
  const color = tone === 'ok' ? 'text-ok' : tone === 'pending' ? 'text-pending' : 'text-blue'
  return (
    <div className="st-stamp pointer-events-none shrink-0" style={{ width: size, height: size }} role="img" aria-label="Stamped: sealed, witnessed by Saksi">
      <svg viewBox="0 0 132 132" className={`h-full w-full ${color}`}>
        <defs>
          <path id={`seal-${id}`} d={`M66,66 m-${t},0 a${t},${t} 0 1,1 ${t * 2},0 a${t},${t} 0 1,1 -${t * 2},0`} />
        </defs>
        <circle cx="66" cy="66" r="58" fill="none" stroke="currentColor" strokeWidth="2.6" opacity="0.92" />
        <circle cx="66" cy="66" r="40" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.75" />
        <text fill="currentColor" fontSize="9.2" fontWeight="700" letterSpacing="1.1" fontFamily="var(--font-geist-mono)">
          <textPath href={`#seal-${id}`}>{text}</textPath>
        </text>
        <path d="M51 64.5 61.5 75 81 54" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ---- carbon copy ticket --------------------------------------------------------------------------

export type CarbonStatus = 'draft' | 'sealing' | 'sealed' | 'stopped'

export type CarbonData = {
  controllerName: string
  code: string
  eventType: EventTypeCode
  purposeText: string
  legalBasisKey: LegalBasisKey
  dataCategories: readonly DataCategory[]
  system?: string
  operatorRef?: string
  /** ms epoch or ISO; 0 / '' = before the first clock tick. */
  at: number | string
}

const PILL: Record<CarbonStatus, { text: string; cls: string }> = {
  draft: { text: 'Draft · not sealed yet', cls: 'bg-paper-2 text-ink-2' },
  sealing: { text: 'Sealing…', cls: 'bg-pending-bg text-pending' },
  sealed: { text: 'Sealed on the public ledger', cls: 'bg-ok-bg text-ok' },
  stopped: { text: 'Not sealed', cls: 'bg-paper-2 text-ink-2' },
}

/** A typed value: keyed by its text so each change gets the 1.2 s blue wash (the receipt being written). */
function Ink({ value, placeholder }: { value: string; placeholder: string }) {
  if (!value) return <span className="text-ink-3">{placeholder}</span>
  return (
    <span key={value} className="ag-ink">
      {value}
    </span>
  )
}

export function legalBasisLine(k: LegalBasisKey): string {
  return `${LEGAL_BASES[k]} · Pasal 20(2)(${k.slice(-1)})`
}

/** Accepts the hex the receipt stores as well as the key. */
export function toBasisKey(v: string | null | undefined): LegalBasisKey | null {
  if (!v) return null
  if (v in LEGAL_BASES) return v as LegalBasisKey
  return basisKeyFromHex(v.startsWith('0x') ? v : stringToHex(v, { size: 32 }))
}

/**
 * The agency's carbon copy of the citizen receipt (riset-ui/37 §4): the same ticket, notches and perforation as
 * the citizen's detail ticket, with an "Agency copy" label. Used live next to the form and in the access log sheet.
 */
export function CarbonTicket({
  data,
  status,
  sealedAt,
  compact = false,
}: {
  data: CarbonData
  status: CarbonStatus
  /** When the ledger sealed it (ms or ISO), shown in plain words. */
  sealedAt?: number | string | null
  compact?: boolean
}) {
  const stamp = status === 'sealed' ? 'sealed' : status === 'sealing' ? 'checking' : null
  const when = data.at ? formatWIB(data.at) : '—'
  const facts: Array<[string, ReactNode]> = [
    ['Citizen', data.code ? <span key={data.code} className="ag-ink doto text-[19px] tracking-[0.08em]">{data.code}</span> : <span className="text-ink-3">Six-character code</span>],
    ['Action', VERB[data.eventType] === 'Shared' ? 'Shared with third party' : VERB[data.eventType]],
    ['Purpose', <Ink key="p" value={data.purposeText} placeholder="Your purpose appears here" />],
    ['Legal basis', legalBasisLine(data.legalBasisKey)],
    ['Data used', <Ink key="d" value={data.dataCategories.map((c) => DATA_CATEGORY_LABELS[c]).join(', ')} placeholder="Pick at least one" />],
    ['Recorded from', [data.system || data.controllerName || 'Your registered name', data.operatorRef].filter(Boolean).join(' · ')],
    ['Sealed', sealedAt ? formatWIB(sealedAt) : status === 'sealing' ? 'Sealing…' : 'Not yet'],
  ]
  return (
    <div className="-mx-4 overflow-x-clip px-4 py-1">
      <div className="st-shadow relative">
        <article aria-label="Agency copy of the citizen's receipt" className="ag-carbon">
          <div className={`st-half-top relative rounded-t-[16px] bg-card px-5 pb-6 ${compact ? 'pt-4' : 'pt-5'}`}>
            <div className={`flex flex-col gap-4 ${stamp ? 'pr-[96px]' : ''}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-bg text-[15px] font-semibold text-blue">
                  {initials(data.controllerName || 'Agency')}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 break-words text-[15px] font-semibold leading-tight text-ink">{data.controllerName || 'Your agency'}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-2">
                    <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-blue" />
                    Agency copy · the citizen gets the original
                  </span>
                </span>
              </div>
              <p className="min-w-0">
                <span className={`block font-semibold leading-[0.92] tracking-[-0.045em] text-ink ${compact ? 'text-[44px]' : 'text-[clamp(40px,10vw,56px)]'}`}>
                  {VERB[data.eventType]}
                </span>
                <span className="mt-1.5 block text-balance text-[19px] leading-tight tracking-[-0.01em] text-ink-2">{TAIL[data.eventType]}.</span>
              </p>
            </div>
            {stamp ? (
              <div className="absolute right-3 top-3">{stamp === 'sealed' ? <SealStamp size={100} /> : <VerdictStamp kind="checking" size={100} />}</div>
            ) : null}
            <p className="mt-3 text-[14px] leading-snug text-ink-2">
              {when} · <Ink value={data.purposeText} placeholder="purpose" />
            </p>
            <p className="mt-4">
              <span key={status} className={`ag-rise inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-[14px] font-medium ${PILL[status].cls}`}>
                {status === 'sealed' ? <IconCheck size={14} strokeWidth={2.6} /> : null}
                {PILL[status].text}
              </span>
            </p>
            <span aria-hidden="true" className="st-perf absolute bottom-0 left-5 right-5 text-line-strong" />
          </div>
          <dl className="st-half-bottom rounded-b-[16px] bg-card py-1.5">
            {facts.map(([k, v], i) => (
              <div key={k} className={`flex min-h-12 items-center gap-4 px-5 py-2.5 ${i ? 'border-t border-line/70' : ''}`}>
                <dt className="w-[104px] shrink-0 text-[14px] text-ink-2">{k}</dt>
                <dd className="min-w-0 flex-1 break-words text-right text-[15px] text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
    </div>
  )
}

// ---- seal stepper ----------------------------------------------------------------------------------

export type SealCopy = [string, string, string, string]
export const RECORD_STEPS: SealCopy = ['Prepared', 'Signed by the agency', 'Sealed on the public ledger', 'Citizen notified']
export const BREACH_STEPS: SealCopy = ['Prepared', 'Signed by the agency', 'Sealed on the public ledger', 'Regulator notified']

function stepDetail(i: number, state: string, tx: TxView, kind: string, last: string): string {
  if (state === 'error') return kind === 'rejected' ? 'You declined in MetaMask' : kind === 'revert' ? 'The registry refused it' : 'Stopped'
  if (i === 0) return state === 'active' ? 'Saksi is fingerprinting the record' : state === 'done' ? 'Fingerprint ready · no names leave your office' : 'Saksi fingerprints the record'
  if (i === 1) return state === 'active' ? 'Confirm the signature in MetaMask' : state === 'done' ? 'Signed with the agency’s digital signature' : 'The agency’s digital signature signs it'
  if (i === 2) {
    if (state === 'active' && kind === 'timeout') return 'Sent · the network is slow, Saksi keeps checking'
    return state === 'active' ? 'Usually 12–20 seconds' : state === 'done' ? 'Nobody can quietly change it now' : 'Written where nobody can quietly change it'
  }
  return state === 'done' ? (last === 'Citizen notified' ? 'Their phone shows the receipt now' : 'It shows on the regulator’s desk now') : last === 'Citizen notified' ? 'The receipt lands on their phone' : 'The regulator sees it'
}

/**
 * Prepared → Signed in wallet → Sealed on the public ledger → Citizen notified (riset-ui/37 §5.3). Each step that
 * finishes ticks in with a drawn check; steps that finish together tick in sequence. Recovery is the same as
 * TxFlow (components/ui/TxStepper): rejected / revert → Try again; sent but slow → re-checked on its own every 10 s.
 */
export function SealStepper({
  tx,
  steps = RECORD_STEPS,
  onRetry,
  onReconfirm,
}: {
  tx: TxView
  steps?: SealCopy
  onRetry?: () => void
  onReconfirm?: () => void
}) {
  const built = buildSteps(tx)
  const kind = tx.phase === 'error' ? txErrorKind(tx.error, Boolean(tx.txHash)) : 'other'
  const doneCount = built.filter((s) => s.state === 'done').length

  // Steps that became done in the same render tick in one after another (180 ms apart).
  const prevDone = useRef(doneCount)
  const base = doneCount > prevDone.current ? prevDone.current : doneCount
  useEffect(() => {
    prevDone.current = doneCount
  }, [doneCount])

  // A sent transaction that is not confirmed yet is re-checked automatically (same rule as TxFlow).
  const autoCheck = tx.phase === 'error' && kind === 'timeout' && !tx.reconfirming && Boolean(onReconfirm)
  const reconfirmRef = useRef(onReconfirm)
  useEffect(() => {
    reconfirmRef.current = onReconfirm
  }, [onReconfirm])
  useEffect(() => {
    if (!autoCheck) return
    const timer = setTimeout(() => reconfirmRef.current?.(), 10_000)
    return () => clearTimeout(timer)
  }, [autoCheck])

  return (
    <div className="flex flex-col gap-4">
      <ol aria-label="Sealing progress" aria-live="polite" className="flex flex-col">
        {built.map((s, i) => {
          const warn = s.state === 'active' && kind === 'timeout'
          const d = s.state === 'done' && i >= base ? (i - base) * 180 : 0
          const lastRow = i === built.length - 1
          return (
            <li key={steps[i]} className="relative flex gap-3.5 pb-5 last:pb-0" aria-current={s.state === 'active' ? 'step' : undefined}>
              {!lastRow ? (
                <span aria-hidden="true" className={`ag-rail absolute left-[13px] top-8 bottom-1 w-[2px] rounded-full ${s.state === 'done' ? 'bg-ok/50' : 'bg-line'}`} />
              ) : null}
              <span className="relative mt-0.5 flex size-7 shrink-0 items-center justify-center">
                {s.state === 'done' ? (
                  <span key="done" className="ag-dot-done flex size-7 items-center justify-center rounded-full border border-ok bg-ok text-white" style={{ ['--d' as string]: `${d}ms` }}>
                    <svg viewBox="0 0 16 16" className="ag-check size-4" style={{ ['--d' as string]: `${d + 120}ms` }} aria-hidden="true">
                      <path d="M3.5 8.5 6.5 11.5 12.5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : s.state === 'active' ? (
                  warn ? (
                    <span className="flex size-7 items-center justify-center rounded-full border-2 border-pending bg-pending-bg" />
                  ) : (
                    <span className="ag-run size-7 rounded-full" />
                  )
                ) : s.state === 'error' ? (
                  <span className="flex size-7 items-center justify-center rounded-full border border-line-strong bg-paper-2 text-ink-2">
                    <span className="h-[2px] w-2.5 rounded-full bg-current" />
                  </span>
                ) : (
                  <span className="flex size-7 items-center justify-center rounded-full border border-line-strong text-[12px] text-ink-3 tnum">{i + 1}</span>
                )}
              </span>
              <span className="min-w-0 pt-0.5">
                <span className={`block text-[15px] font-medium leading-snug ${s.state === 'todo' ? 'text-ink-2' : 'text-ink'}`}>
                  {steps[i]}
                  <span className="sr-only">
                    {' '}
                    — {s.state === 'done' ? 'done' : s.state === 'active' ? 'in progress' : s.state === 'error' ? 'stopped' : 'not started'}
                  </span>
                </span>
                <span className={`mt-0.5 block text-[13px] leading-snug ${warn ? 'text-pending' : 'text-ink-2'}`}>{stepDetail(i, s.state, tx, kind, steps[3])}</span>
              </span>
            </li>
          )
        })}
      </ol>

      {tx.phase === 'error' ? (
        <div key={kind} className="ag-rise flex flex-col items-start gap-3 rounded-[12px] bg-paper-2/70 p-4" role="alert">
          {kind === 'rejected' ? (
            <p className="text-[14px] leading-relaxed text-ink">
              <strong className="font-semibold">You declined the signature.</strong> <span className="text-ink-2">Nothing left your office. The form still has your values.</span>
            </p>
          ) : kind === 'revert' ? (
            <>
              <p className="text-[14px] font-medium text-ink" title={tx.error?.errorName ? `Contract: ${tx.error.errorName}` : undefined}>
                {revertReason(tx.error?.errorName)}
              </p>
              <p className="text-[14px] leading-relaxed text-ink-2">{tx.error?.message ?? 'The registry refused this record.'}</p>
            </>
          ) : kind === 'timeout' ? (
            <p className="text-[14px] leading-relaxed text-ink-2">
              The signed record is on its way. {CHAIN_NAME} is slow, so Saksi keeps checking on its own. <strong className="font-semibold text-ink">Don’t sign again.</strong>
            </p>
          ) : (
            <p className="text-[14px] leading-relaxed text-ink">{tx.error?.message ?? 'Something went wrong before sealing.'}</p>
          )}
          {kind === 'timeout' ? (
            <Button variant="light" size="sm" loading={tx.reconfirming} disabled={tx.reconfirming} onClick={onReconfirm}>
              {tx.reconfirming ? 'Checking…' : 'Check now'}
            </Button>
          ) : (
            <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      ) : null}

      {tx.txHash || tx.blockNumber != null ? (
        <TechProof
          rows={[
            ['Transaction', tx.txHash ? <TxLink hash={tx.txHash} /> : null],
            ['Block', tx.blockNumber != null ? Number(tx.blockNumber).toLocaleString('en-US') : null],
            ['Network', CHAIN_NAME],
          ]}
        />
      ) : null}
    </div>
  )
}

// ---- wallet states ---------------------------------------------------------------------------------

type WalletHandlers = { onConnect?: () => void; onSwitchNetwork?: () => void; onRefresh?: () => void; onCopy?: (text: string) => void }

function AddressLine({ address, onCopy }: { address?: string; onCopy?: (t: string) => void }) {
  if (!address) return null
  return (
    <div className="flex w-full max-w-[440px] items-center justify-between gap-3 rounded-[12px] bg-paper-2/70 py-2 pl-3.5 pr-2">
      <span className="min-w-0">
        <span className="block text-[12px] text-ink-2">This signature’s address</span>
        <span className="block truncate font-mono text-[14px] text-ink">{shortHex(address, 10, 8)}</span>
      </span>
      {onCopy ? (
        <button
          type="button"
          onClick={() => onCopy(address)}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md px-3 text-[14px] font-medium text-blue transition-colors duration-150 hover:bg-blue-bg"
        >
          <IconCopy size={14} /> Copy
        </button>
      ) : null}
    </div>
  )
}

/**
 * One designed panel per wallet state (riset-ui/37 brief §5): a plain title, what to do in one or two sentences,
 * one action, and the five checks on the side. `inline` drops the card and the check list (inside a side panel).
 */
export function AgencyWalletPanel({ wallet, inline = false, ...h }: { wallet: WalletView; inline?: boolean } & WalletHandlers) {
  const { state, isChecking, address, balance, error, isConnecting, isSwitching } = wallet
  const key = isChecking ? 'checking' : state
  let tone: 'blue' | 'amber' | 'ink' = 'blue'
  let icon: ReactNode = <IconWallet size={22} />
  let title = ''
  let body: ReactNode = null
  let action: ReactNode = null
  let extra: ReactNode = null

  if (isChecking) {
    tone = 'ink'
    icon = <span className="ag-run size-6 rounded-full" />
    title = 'Checking the agency’s signature'
    body = `Reading the agency registry on ${CHAIN_NAME}. This takes a few seconds.`
  } else if (state === 'no_wallet') {
    title = 'Install MetaMask to hold the agency’s signature'
    body = 'Every lookup is signed with the agency’s digital signature. In this prototype the signature lives in MetaMask: add the extension to this browser, then reload the page.'
    action = (
      <ButtonLink href={METAMASK_URL} external variant="dark" arrow>
        Install MetaMask
      </ButtonLink>
    )
  } else if (state === 'disconnected') {
    title = 'Connect the agency’s digital signature'
    body = 'Saksi checks the public registry to confirm this signature belongs to a registered agency. Nothing is signed yet.'
    action = (
      <Button variant="dark" arrow loading={isConnecting} disabled={isConnecting} onClick={h.onConnect}>
        {isConnecting ? 'Waiting for MetaMask…' : 'Connect signature'}
      </Button>
    )
  } else if (state === 'wrong_network') {
    tone = 'amber'
    icon = <IconAlert size={22} />
    title = `Point the signature at ${CHAIN_NAME}`
    body = `Saksi keeps its public ledger on the ${CHAIN_NAME} test network, and MetaMask is set to another one. One click switches it.`
    action = (
      <Button variant="dark" arrow loading={isSwitching} disabled={isSwitching} onClick={h.onSwitchNetwork}>
        {isSwitching ? 'Confirm in MetaMask…' : `Switch to ${CHAIN_NAME}`}
      </Button>
    )
    extra = <AddressLine address={address} />
  } else if (state === 'not_registered') {
    tone = 'amber'
    icon = <IconShield size={22} />
    title = 'This signature isn’t registered yet'
    body = 'The registry has no agency for this signature. Copy its address for your Saksi administrator (the regulator), and press Check again once they confirm.'
    action = (
      <Button variant="light" icon={<IconRefresh size={15} />} onClick={h.onRefresh}>
        Check again
      </Button>
    )
    extra = <AddressLine address={address} onCopy={h.onCopy} />
  } else {
    tone = 'amber'
    title = 'The signing fee needs topping up'
    body = `Each seal pays a tiny network fee in free ${CHAIN_NAME} test ETH. This signature holds ${formatEth(balance)} and needs at least 0.002. Get free test ETH from the faucet, then check again.`
    action = (
      <span className="flex flex-wrap gap-3">
        <ButtonLink href={FAUCET_URL} external variant="dark" arrow>
          Get test ETH
        </ButtonLink>
        <Button variant="light" icon={<IconRefresh size={15} />} onClick={h.onRefresh}>
          Check again
        </Button>
      </span>
    )
    extra = <AddressLine address={address} />
  }

  const tile = tone === 'amber' ? 'bg-pending-bg text-pending' : tone === 'ink' ? 'bg-paper-2 text-ink' : 'bg-blue-bg text-blue'
  const errorLine = error ? (
    <p className="ag-rise flex items-start gap-2 text-[14px] leading-relaxed text-pending" role="alert">
      <span aria-hidden="true" className="mt-[8px] size-1.5 shrink-0 rounded-full bg-pending" /> {error}
    </p>
  ) : null

  const main = (
    <div key={key} className="ag-rise flex flex-col items-start gap-4">
      <span className={`flex size-12 items-center justify-center rounded-[12px] ${tile}`}>{icon}</span>
      <div>
        <h2 className={`font-semibold leading-tight tracking-[-0.02em] text-ink ${inline ? 'text-[18px]' : 'text-[22px]'}`}>{title}</h2>
        <p className="mt-1.5 max-w-[52ch] text-[15px] leading-relaxed text-ink-2">{body}</p>
      </div>
      {extra}
      {errorLine}
      {action}
    </div>
  )

  if (inline) {
    return (
      <div role="status" aria-busy={isChecking || undefined}>
        {main}
      </div>
    )
  }
  return (
    <section role="status" aria-busy={isChecking || undefined} aria-label="Wallet check" className="ag-group grid gap-8 p-6 md:p-8 lg:grid-cols-[1fr_280px] lg:gap-10">
      {main}
      <div className="lg:border-l lg:border-line lg:pl-10">
        <p className="mb-4 text-[15px] font-semibold text-ink">Before you can sign</p>
        <WalletChecks state={state} checking={isChecking} />
      </div>
    </section>
  )
}
