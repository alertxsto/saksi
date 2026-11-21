'use client'

import type { CSSProperties, ReactNode } from 'react'
import { formatEther } from 'viem'
import type { WalletSnapshot, WalletState } from '@/lib/data'
import { CHAIN_NAME } from '@/lib/env'
import { shortHex } from '@/lib/format'
import { Button, ButtonLink } from './Button'
import { IconCheck, IconCopy, IconRefresh, IconSpinner } from './icons'

export type { WalletState }
export { CHAIN_NAME }

/** Props shape = the wallet fields the controller screens read (filled from useWalletState in lib/client/wagmi.ts). */
export type WalletView = Pick<WalletSnapshot, 'state'> &
  Partial<Pick<WalletSnapshot, 'isChecking' | 'address' | 'controller' | 'balance' | 'error' | 'isConnecting' | 'isSwitching'>>

export const WALLET_STATES: WalletState[] = ['no_wallet', 'disconnected', 'wrong_network', 'not_registered', 'no_gas', 'ready']

export const METAMASK_URL = 'https://metamask.io/download/'
/** Test-ETH faucet for the default chain; set NEXT_PUBLIC_FAUCET_URL when CHAIN_NAME changes. */
export const FAUCET_URL =
  process.env.NEXT_PUBLIC_FAUCET_URL || 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia'
/** Mirrors minimumBalance (0.002 ETH) in lib/client/wagmi.ts. */
const MIN_GAS_LABEL = '0.002'

/** Check names, in the order useWalletState runs them (the state names the first check that fails). */
const CHECKS: Record<WalletState, string> = {
  no_wallet: 'Signature app found (MetaMask)',
  disconnected: 'Signature connected',
  wrong_network: `On the ${CHAIN_NAME} public ledger`,
  not_registered: 'Registered as this agency',
  no_gas: 'Enough test ETH to seal',
  ready: 'Ready to seal',
}

export function formatEth(wei: bigint | undefined): string {
  if (wei === undefined) return '—'
  const n = Number(formatEther(wei))
  return `${n < 0.0001 && n > 0 ? '<0.0001' : n.toFixed(4)} ETH`
}

type CheckState = 'passed' | 'failing' | 'checking' | 'waiting'

function checkStates(state: WalletState, checking: boolean): CheckState[] {
  const idx = WALLET_STATES.indexOf(state)
  return WALLET_STATES.map((s, i) =>
    state === 'ready' || i < idx ? 'passed' : checking && i === idx ? 'checking' : i === idx && s !== 'ready' ? 'failing' : 'waiting',
  )
}

const MARK: Record<CheckState, string> = {
  passed: 'bg-ok text-white',
  failing: 'border border-pending bg-pending-bg',
  checking: 'border border-blue',
  waiting: 'border border-line-strong',
}
const WORD: Record<CheckState, string> = { passed: 'Passed', failing: 'Needs you', checking: 'Checking…', waiting: 'Not yet' }

/**
 * The six wallet checks as a key/value list (Base "Review" grammar): name left, result right, hairlines
 * between. `compact` = one row of marks with only the failing check named (inside a side panel).
 */
export function WalletChecks({ state, checking = false, compact = false }: { state: WalletState; checking?: boolean; compact?: boolean }) {
  const st = checkStates(state, checking)
  if (compact) {
    return (
      <ol aria-label="Signature checks" className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {WALLET_STATES.map((s, i) => (
          <li key={s} aria-current={st[i] === 'failing' ? 'step' : undefined} className="relative flex items-center gap-2">
            <span aria-hidden="true" className={`flex size-4 shrink-0 items-center justify-center rounded-full ${MARK[st[i]]}`}>
              {st[i] === 'passed' ? <IconCheck size={10} strokeWidth={3.2} /> : null}
            </span>
            <span className={`font-mono text-[12px] ${st[i] === 'failing' ? 'text-pending' : 'sr-only'}`}>
              {CHECKS[s]}
              <span className="sr-only"> — {WORD[st[i]]}</span>
            </span>
          </li>
        ))}
      </ol>
    )
  }
  return (
    <ol aria-label="Signature checks" className="flex flex-col">
      {WALLET_STATES.map((s, i) => (
        <li
          key={s}
          aria-current={st[i] === 'failing' ? 'step' : undefined}
          className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0"
        >
          <span className={`flex items-center gap-3 text-[15px] ${st[i] === 'waiting' ? 'text-ink-3' : 'text-ink'}`}>
            <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${MARK[st[i]]}`}>
              {st[i] === 'passed' ? <IconCheck size={11} strokeWidth={3} /> : st[i] === 'checking' ? <IconSpinner size={11} className="text-blue" /> : null}
            </span>
            {CHECKS[s]}
          </span>
          <span className={`font-mono text-[12px] ${st[i] === 'failing' ? 'text-pending' : st[i] === 'passed' ? 'text-ok' : 'text-ink-3'}`}>{WORD[st[i]]}</span>
        </li>
      ))}
    </ol>
  )
}

/** Compatibility: the old six-segment strip, now the compact row of check marks. */
export function WalletStrip({ state }: { state: WalletState }) {
  return <WalletChecks state={state} compact />
}

function AddressRow({ address, onCopy }: { address?: `0x${string}`; onCopy?: (text: string) => void }) {
  if (!address) return null
  return (
    <p className="flex flex-wrap items-center gap-2 font-mono text-[13px] text-ink-2">
      <span className="text-ink">{shortHex(address, 6, 4)}</span>
      {onCopy ? (
        <button
          type="button"
          onClick={() => onCopy(address)}
          className="inline-flex min-h-8 items-center gap-1 rounded-sm px-1.5 font-mono text-[12px] text-blue transition-colors duration-150 hover:bg-blue-bg"
        >
          <IconCopy size={12} /> Copy address
        </button>
      ) : null}
    </p>
  )
}

type GateCopy = { title: string; body: ReactNode; action: ReactNode; extra: ReactNode }

function gateCopy(wallet: WalletView, h: Pick<GateProps, 'onConnect' | 'onSwitchNetwork' | 'onRefresh' | 'onCopy'>): GateCopy {
  const { state, isChecking, address, balance, isConnecting, isSwitching } = wallet
  if (isChecking)
    return { title: 'Checking the agency’s signature…', body: `Reading the agency registry and the signing balance on ${CHAIN_NAME}.`, action: null, extra: null }
  switch (state) {
    case 'no_wallet':
      return {
        title: 'MetaMask is not installed',
        body: 'Every record is signed with the agency’s digital signature, which lives in MetaMask. Install it in this browser, then reload.',
        action: (
          <ButtonLink href={METAMASK_URL} external variant="dark" arrow>
            Install MetaMask
          </ButtonLink>
        ),
        extra: null,
      }
    case 'disconnected':
      return {
        title: 'Connect the agency’s signature',
        body: 'Saksi checks the public agency registry to confirm this signature belongs to a registered agency. Nothing is signed yet.',
        action: (
          <Button variant="dark" arrow loading={isConnecting} disabled={isConnecting} onClick={h.onConnect}>
            {isConnecting ? 'Waiting for MetaMask…' : 'Connect signature'}
          </Button>
        ),
        extra: null,
      }
    case 'wrong_network':
      return {
        title: `Switch to ${CHAIN_NAME}`,
        body: `MetaMask is set to another network. Saksi keeps its public ledger on ${CHAIN_NAME}.`,
        action: (
          <Button variant="dark" arrow loading={isSwitching} disabled={isSwitching} onClick={h.onSwitchNetwork}>
            {isSwitching ? 'Confirm in MetaMask…' : `Switch to ${CHAIN_NAME}`}
          </Button>
        ),
        extra: <AddressRow address={address} />,
      }
    case 'not_registered':
      return {
        title: 'This signature isn’t registered as an agency',
        body: 'The agency registry has no entry for this signature. Send the address below to your Saksi administrator (the regulator) and ask them to register it. Then check again.',
        action: (
          <Button variant="light" icon={<IconRefresh size={15} />} onClick={h.onRefresh}>
            Check again
          </Button>
        ),
        extra: <AddressRow address={address} onCopy={h.onCopy} />,
      }
    default:
      // no_gas (ready never reaches the gate copy)
      return {
        title: 'Not enough test ETH to seal',
        body: `Each seal pays a tiny network fee in free ${CHAIN_NAME} test ETH. You need at least ${MIN_GAS_LABEL}. Get some from the faucet, then check again.`,
        action: (
          <span className="flex flex-wrap gap-3">
            <ButtonLink href={FAUCET_URL} external variant="dark" arrow>
              Get free test ETH
            </ButtonLink>
            <Button variant="light" icon={<IconRefresh size={15} />} onClick={h.onRefresh}>
              Check again
            </Button>
          </span>
        ),
        extra: (
          <p className="flex flex-wrap items-center gap-3 font-mono text-[13px] text-ink-2">
            <span className="text-ink">{shortHex(address, 6, 4)}</span>
            <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
            <span className="text-pending">Holds {formatEth(balance)}</span>
          </p>
        ),
      }
  }
}

type GateProps = {
  wallet: WalletView
  onConnect?: () => void
  onSwitchNetwork?: () => void
  onRefresh?: () => void
  onCopy?: (text: string) => void
  children?: ReactNode
  /**
   * hero (default): the not-ready state is one paper panel that replaces the whole console (message +
   * one action left, the six checks right); the ready state is a hairline identity line above the children.
   * inline: no panel of its own, for use inside a side panel (breach seal panel).
   */
  variant?: 'hero' | 'inline'
}

/**
 * Wraps a controller form: renders it only when the wallet is ready; otherwise the state's
 * message + one action. Handlers: onConnect (connect), onSwitchNetwork (wallet network switch),
 * onRefresh (refresh, "Check again"), onCopy (copy the address for the admin).
 */
export function WalletGate({ wallet, onConnect, onSwitchNetwork, onRefresh, onCopy, children, variant = 'hero' }: GateProps) {
  const { state, isChecking, address, controller, balance, error } = wallet

  if (state === 'ready' && !isChecking) {
    if (variant === 'inline') return <>{children}</>
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
          <p className="flex items-center gap-2.5 text-[15px] text-ink-2">
            <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center rounded-full bg-ok text-white">
              <IconCheck size={10} strokeWidth={3.2} />
            </span>
            <span>
              <strong className="font-medium text-ink">Registered as {controller?.name ?? 'this agency'}</strong> · confirmed in the agency
              registry on {CHAIN_NAME}
            </span>
          </p>
          <p className="flex items-center gap-3 font-mono text-[13px] text-ink-2">
            <span className="text-ink">{shortHex(address, 6, 4)}</span>
            <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
            <span>{formatEth(balance)}</span>
          </p>
        </div>
        {children}
      </div>
    )
  }

  const c = gateCopy(wallet, { onConnect, onSwitchNetwork, onRefresh, onCopy })
  const key = isChecking ? 'checking' : state
  const errorLine = error ? (
    <p className="ctl-in flex items-start gap-2 text-[14px] leading-relaxed text-pending" role="alert">
      <span aria-hidden="true" className="mt-[8px] size-1.5 shrink-0 rounded-full bg-pending" /> {error}
    </p>
  ) : null

  if (variant === 'inline') {
    return (
      <div role="status" aria-busy={isChecking || undefined} className="flex flex-col items-start gap-4">
        <WalletChecks state={state} checking={isChecking} compact />
        <div key={key} className="ctl-in">
          <p className="text-[17px] font-medium leading-snug tracking-[-0.015em] text-ink">{c.title}</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{c.body}</p>
        </div>
        {c.extra}
        {errorLine}
        {c.action}
      </div>
    )
  }

  return (
    <section role="status" aria-busy={isChecking || undefined} aria-label="Signature check" className="rounded-xl border border-line bg-card">
      <div className="grid gap-10 p-6 md:p-10 lg:grid-cols-12 lg:gap-12">
        <div className="flex flex-col items-start gap-5 lg:col-span-7">
          <h2 key={key} className="ctl-in max-w-[24ch] text-balance text-[26px] font-medium leading-[1.12] tracking-[-0.02em] text-ink md:text-[32px]">
            {c.title}
          </h2>
          <p key={`${key}-b`} className="ctl-in max-w-[52ch] text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2" style={{ '--d': '80ms' } as CSSProperties}>
            {c.body}
          </p>
          {c.extra}
          {errorLine}
          {c.action ? (
            <div key={`${key}-a`} className="ctl-in pt-1" style={{ '--d': '140ms' } as CSSProperties}>
              {c.action}
            </div>
          ) : null}
        </div>
        <div className="lg:col-span-5 lg:border-l lg:border-line lg:pl-12">
          <p className="label mb-4 text-[11px] text-ink-2">Before you can seal</p>
          <WalletChecks state={state} checking={isChecking} />
        </div>
      </div>
    </section>
  )
}
