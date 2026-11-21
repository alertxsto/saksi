'use client'

import { createContext, use, useCallback, useState, type ReactNode } from 'react'
import { IconWallet } from '@/components/ui/icons'
import { useToast } from '@/components/ui/Toast'
import { CHAIN_NAME } from '@/components/ui/WalletGate'
import { useWalletState } from '@/lib/client/wagmi'
import { copyText, DEMO_CONTROLLER_IDS, type WalletSnapshot } from '@/lib/data'
import { shortHex } from '@/lib/format'

type ControllerWallet = {
  wallet: WalletSnapshot
  onConnect: () => void
  onSwitchNetwork: () => void
  onRefresh: () => void
  onCopy: (text: string) => void
}

const Ctx = createContext<ControllerWallet | null>(null)

export function useControllerWallet(): ControllerWallet {
  const v = use(Ctx)
  if (!v) throw new Error('useControllerWallet must be used inside ControllerWalletProvider')
  return v
}

const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

/**
 * One wallet for both controller pages and the header chip: useWalletState (lib/client/wagmi.ts) checks
 * the injected wallet, the network, the ControllerRegistry registration and the gas balance.
 */
export function ControllerWalletProvider({ children }: { children: ReactNode }) {
  const w = useWalletState(DEMO_CONTROLLER_IDS)
  const [actionError, setActionError] = useState<string | null>(null)
  const { toast } = useToast()

  const registered = w.state === 'ready' || w.state === 'no_gas'
  const wallet: WalletSnapshot = {
    state: w.state,
    isChecking: w.isChecking,
    address: 'address' in w ? w.address : undefined,
    controller: registered ? { id: w.controllerId, name: w.name } : undefined,
    balance: registered ? w.balance : undefined,
    error: actionError ?? w.checkError?.message ?? null,
    isConnecting: w.isConnecting,
    isSwitching: w.isSwitching,
  }

  const { connect, switchToSepolia, refresh } = w
  const run = useCallback(async (fn: () => Promise<void>, fallback: string) => {
    setActionError(null)
    try {
      await fn()
    } catch (e) {
      setActionError(message(e, fallback))
    }
  }, [])

  const onConnect = useCallback(() => void run(connect, 'The wallet did not connect.'), [run, connect])
  const onSwitchNetwork = useCallback(() => void run(switchToSepolia, `Could not switch the wallet to ${CHAIN_NAME}.`), [run, switchToSepolia])
  const onRefresh = useCallback(() => void run(refresh, 'Could not check the wallet again.'), [run, refresh])
  const onCopy = useCallback(
    (text: string) => {
      copyText(text).then(
        () => toast('Address copied · send it to your Saksi admin'),
        () => toast('Could not copy. Select the address and copy it by hand.', 'bad'),
      )
    },
    [toast],
  )

  return <Ctx value={{ wallet, onConnect, onSwitchNetwork, onRefresh, onCopy }}>{children}</Ctx>
}

/** Header chip: one pill, network + wallet address (or the failing check), with a status dot. */
export function WalletChips() {
  const { wallet } = useControllerWallet()
  const ready = wallet.state === 'ready' && !wallet.isChecking
  const label = wallet.isChecking ? 'Checking…' : wallet.address ? shortHex(wallet.address, 6, 4) : 'Not connected'
  return (
    <span className="label inline-flex h-8 items-center gap-2.5 whitespace-nowrap rounded-pill border border-line-strong bg-card pl-3 pr-3.5 text-[11px] text-ink-2">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${ready ? 'bg-ok' : wallet.isChecking ? 'bg-ink-3' : 'bg-pending'}`}
      />
      <span className={wallet.state === 'wrong_network' ? 'text-pending' : ''}>{CHAIN_NAME}</span>
      <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
      <IconWallet size={12} />
      <span className={`text-ink ${wallet.address ? 'normal-case' : ''}`}>{label}</span>
    </span>
  )
}
