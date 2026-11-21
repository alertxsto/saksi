'use client'

import type { ReactNode } from 'react'
import { formatEther } from 'viem'
import type { WalletSnapshot, WalletState } from '@/lib/data'
import { shortHex } from '@/lib/format'
import { Button, ButtonLink } from './Button'
import { DotIcon } from './DotIcon'
import { IconAlert, IconCheck, IconCopy, IconRefresh, IconSpinner, IconWallet } from './icons'

export type { WalletState }

/** Props shape = the wallet fields the controller screens read (filled from useWalletState in lib/client/wagmi.ts). */
export type WalletView = Pick<WalletSnapshot, 'state'> &
  Partial<Pick<WalletSnapshot, 'isChecking' | 'address' | 'controller' | 'balance' | 'error' | 'isConnecting' | 'isSwitching'>>

export const WALLET_STATES: WalletState[] = ['no_wallet', 'disconnected', 'wrong_network', 'not_registered', 'no_gas', 'ready']

export const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME || 'Sepolia'
export const METAMASK_URL = 'https://metamask.io/download/'
/** Sepolia faucet; override with NEXT_PUBLIC_FAUCET_URL. */
export const FAUCET_URL =
  process.env.NEXT_PUBLIC_FAUCET_URL || 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia'
/** Mirrors minimumBalance (0.002 ETH) in lib/client/wagmi.ts. */
const MIN_GAS_LABEL = '0.002'

/** Strip labels name the check that passed (not the failure state). */
const PASSED: Record<WalletState, string> = {
  no_wallet: 'WALLET FOUND',
  disconnected: 'CONNECTED',
  wrong_network: `ON ${CHAIN_NAME.toUpperCase()}`,
  not_registered: 'REGISTERED',
  no_gas: 'HAS GAS',
  ready: 'READY',
}

const SHORT: Record<WalletState, string> = {
  no_wallet: 'NO WALLET',
  disconnected: 'DISCONNECTED',
  wrong_network: 'WRONG NETWORK',
  not_registered: 'NOT REGISTERED',
  no_gas: 'NO GAS',
  ready: 'READY',
}

export function formatEth(wei: bigint | undefined): string {
  if (wei === undefined) return '—'
  const n = Number(formatEther(wei))
  return `${n < 0.0001 && n > 0 ? '<0.0001' : n.toFixed(4)} ETH`
}

/** Six-segment status strip; the current state is highlighted. */
export function WalletStrip({ state }: { state: WalletState }) {
  const idx = WALLET_STATES.indexOf(state)
  return (
    <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6" aria-label="Wallet checks">
      {WALLET_STATES.map((s, i) => {
        const passed = i < idx || state === 'ready'
        const current = s === state
        return (
          <li
            key={s}
            aria-current={current ? 'step' : undefined}
            className={`label flex min-h-11 w-full items-center gap-2 px-3 text-[11px] ${current ? 'bg-card text-ink' : 'bg-paper text-ink-2'}`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm ${
                current && s !== 'ready' ? 'bg-pending text-white' : passed ? 'bg-ok text-white' : 'border border-line-strong'
              }`}
              aria-hidden="true"
            >
              {passed ? <IconCheck size={11} strokeWidth={3} /> : current ? <IconAlert size={10} strokeWidth={3} /> : null}
            </span>
            <span className="truncate">{current && s !== 'ready' ? SHORT[s] : PASSED[s]}</span>
          </li>
        )
      })}
    </ol>
  )
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
          className="label inline-flex min-h-8 items-center gap-1 rounded-sm px-1.5 text-[11px] text-blue hover:bg-blue-bg"
        >
          <IconCopy size={12} /> Copy address
        </button>
      ) : null}
    </p>
  )
}

/**
 * Wraps a controller form: renders it only when the wallet is ready; otherwise the state's
 * message + one action. Handlers: onConnect (connect), onSwitchNetwork (switchToSepolia),
 * onRefresh (refresh, "Check again"), onCopy (copy the address for the admin).
 */
export function WalletGate({
  wallet,
  onConnect,
  onSwitchNetwork,
  onRefresh,
  onCopy,
  children,
}: {
  wallet: WalletView
  onConnect?: () => void
  onSwitchNetwork?: () => void
  onRefresh?: () => void
  onCopy?: (text: string) => void
  children?: ReactNode
}) {
  const { state, isChecking, address, controller, balance, error, isConnecting, isSwitching } = wallet

  if (state === 'ready' && !isChecking) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-ok/25 bg-ok-bg/60 px-4 py-3">
          <p className="flex items-center gap-2.5 text-[14px] text-ok">
            <DotIcon name="check" size={18} className="shrink-0" />
            <span>
              <strong className="font-semibold">Registered as {controller?.name ?? 'a controller'}</strong>
              <span className="text-ok/90"> · read from ControllerRegistry on {CHAIN_NAME}</span>
            </span>
          </p>
          <p className="flex items-center gap-3 font-mono text-[13px] text-ink-2">
            <span className="text-ink">{shortHex(address, 6, 4)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatEth(balance)}</span>
          </p>
        </div>
        {children}
      </div>
    )
  }

  let title: string
  let body: ReactNode
  let action: ReactNode = null
  let extra: ReactNode = null

  if (isChecking) {
    title = 'Checking your wallet…'
    body = `Reading the network, ControllerRegistry and balance on ${CHAIN_NAME}.`
  } else if (state === 'no_wallet') {
    title = 'MetaMask is not installed'
    body = 'Controllers sign each record with their registered wallet. Install MetaMask in this browser, then reload.'
    action = (
      <ButtonLink href={METAMASK_URL} external variant="dark" arrow>
        Install MetaMask
      </ButtonLink>
    )
  } else if (state === 'disconnected') {
    title = 'Connect your controller wallet'
    body = 'Saksi reads ControllerRegistry to check that this address belongs to a registered controller.'
    action = (
      <Button variant="dark" arrow loading={isConnecting} disabled={isConnecting} onClick={onConnect}>
        {isConnecting ? 'Waiting for MetaMask…' : 'Connect wallet'}
      </Button>
    )
  } else if (state === 'wrong_network') {
    title = `Switch to ${CHAIN_NAME}`
    body = `Your wallet is on another network. Saksi records live on ${CHAIN_NAME}.`
    extra = <AddressRow address={address} />
    action = (
      <Button variant="dark" arrow loading={isSwitching} disabled={isSwitching} onClick={onSwitchNetwork}>
        {isSwitching ? 'Confirm in MetaMask…' : `Switch to ${CHAIN_NAME}`}
      </Button>
    )
  } else if (state === 'not_registered') {
    title = 'This address is not a registered controller'
    body = (
      <>
        ControllerRegistry has no active binding for this wallet. Send the address below to your Saksi admin (the regulator)
        and ask them to register it. Then check again.
      </>
    )
    extra = <AddressRow address={address} onCopy={onCopy} />
    action = (
      <Button variant="light" icon={<IconRefresh size={15} />} onClick={onRefresh}>
        Check again
      </Button>
    )
  } else {
    // no_gas
    title = `Not enough ${CHAIN_NAME} ETH`
    body = `Sealing a record costs a little gas. You need at least ${MIN_GAS_LABEL} ${CHAIN_NAME} ETH. Get free test ETH from the faucet, then check again.`
    extra = (
      <p className="flex flex-wrap items-center gap-3 font-mono text-[13px] text-ink-2">
        <span className="text-ink">{shortHex(address, 6, 4)}</span>
        <span aria-hidden="true">·</span>
        <span className="text-pending">Balance {formatEth(balance)}</span>
      </p>
    )
    action = (
      <span className="flex flex-wrap gap-3">
        <ButtonLink href={FAUCET_URL} external variant="dark" arrow>
          Get {CHAIN_NAME} ETH
        </ButtonLink>
        <Button variant="light" icon={<IconRefresh size={15} />} onClick={onRefresh}>
          Check again
        </Button>
      </span>
    )
  }

  return (
    <div role="status" aria-busy={isChecking || undefined} className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-line-strong bg-card p-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-pending-bg text-pending">
        {isChecking ? <IconSpinner size={20} /> : <IconWallet size={20} />}
      </span>
      <div>
        <p className="label text-pending">WALLET · {isChecking ? 'CHECKING' : SHORT[state]}</p>
        <p className="mt-1 text-[20px] font-medium tracking-[-0.02em] text-ink">{title}</p>
        <p className="mt-1.5 max-w-[56ch] text-[15px] leading-relaxed text-ink-2">{body}</p>
      </div>
      {extra}
      {error ? (
        <p className="flex items-start gap-2 text-[14px] text-pending" role="alert">
          <IconAlert size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : null}
      {action}
    </div>
  )
}
