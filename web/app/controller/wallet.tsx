'use client'

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { sepolia } from 'viem/chains'
import { useAccount } from 'wagmi'
import { IconWallet } from '@/components/ui/icons'
import { useToast } from '@/components/ui/Toast'
import { CHAIN_NAME } from '@/components/ui/WalletGate'
import { useWalletState } from '@/lib/client/wagmi'
import { controllerCandidates, copyText, type RegistryLogRef, type WalletSnapshot } from '@/lib/data'
import { deployBlock, publicClient, registryAbi, registryAddress } from '@/lib/shared/chain'
import { shortHex } from '@/lib/format'

type ControllerWallet = {
  wallet: WalletSnapshot
  onConnect: () => void
  onSwitchNetwork: () => void
  onRefresh: () => void
  onCopy: (text: string) => void
}

const Ctx = createContext<ControllerWallet | null>(null)
const EMPTY: readonly `0x${string}`[] = []

export function useControllerWallet(): ControllerWallet {
  const v = use(Ctx)
  if (!v) throw new Error('useControllerWallet must be used inside ControllerWalletProvider')
  return v
}

const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

const registeredEvent = registryAbi.find((item) => item.type === 'event' && item.name === 'ControllerRegistered')!
const revokedEvent = registryAbi.find((item) => item.type === 'event' && item.name === 'ControllerRevoked')!
const LOG_WINDOW = 10_000n

/** ControllerRegistered / ControllerRevoked logs for this wallet (indexed `eoa`), deploy block to head. */
async function readRegistryLogs(eoa: Address): Promise<{ registered: RegistryLogRef[]; revoked: RegistryLogRef[] }> {
  if (!publicClient || !registryAddress || deployBlock === undefined) throw new Error('The Sepolia registry is not configured.')
  const head = await publicClient.getBlockNumber()
  const registered: RegistryLogRef[] = []
  const revoked: RegistryLogRef[] = []
  const ref = (log: { args: { controllerId: `0x${string}` }; blockNumber: bigint; logIndex: number }) => ({
    controllerId: log.args.controllerId, blockNumber: log.blockNumber, logIndex: log.logIndex,
  })
  for (let fromBlock = deployBlock; fromBlock <= head; fromBlock += LOG_WINDOW) {
    const toBlock = fromBlock + LOG_WINDOW - 1n < head ? fromBlock + LOG_WINDOW - 1n : head
    const query = { address: registryAddress, args: { eoa }, fromBlock, toBlock, strict: true } as const
    const [reg, rev] = await Promise.all([
      publicClient.getLogs({ ...query, event: registeredEvent }),
      publicClient.getLogs({ ...query, event: revokedEvent }),
    ])
    for (const log of reg) if (!log.removed) registered.push(ref(log))
    for (const log of rev) if (!log.removed) revoked.push(ref(log))
  }
  return { registered, revoked }
}

/**
 * One wallet for both controller pages and the header chip. The connected wallet's controller ids come from the
 * registry log (newest active registration first, controllerCandidates in lib/data.ts), with the static demo ids as
 * fallback when the log read fails. useWalletState (lib/client/wagmi.ts) then confirms the first id the contract's
 * isAuthorized accepts and checks the network and the gas balance.
 */
export function ControllerWalletProvider({ children }: { children: ReactNode }) {
  const account = useAccount()
  const resolvable = Boolean(account.address && account.isConnected && account.chainId === sepolia.id)
  const logs = useQuery({
    queryKey: ['saksi-controller-logs', sepolia.id, account.address],
    enabled: resolvable,
    queryFn: () => readRegistryLogs(account.address as Address),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
  const resolving = resolvable && logs.isPending
  const candidates = useMemo(
    () => (logs.data ? controllerCandidates(logs.data.registered, logs.data.revoked) : controllerCandidates(null, [])),
    [logs.data],
  )
  // While the log read runs, check nothing yet: answering from the fallback ids first would flash the wrong name.
  const w = useWalletState(resolving ? EMPTY : candidates)
  const [actionError, setActionError] = useState<string | null>(null)
  const { toast } = useToast()

  const registered = !resolving && (w.state === 'ready' || w.state === 'no_gas')
  const wallet: WalletSnapshot = {
    state: w.state,
    isChecking: w.isChecking || resolving,
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
  const refetchLogs = logs.refetch
  const onRefresh = useCallback(
    () => void run(async () => { await refetchLogs(); await refresh() }, 'Could not check the wallet again.'),
    [run, refresh, refetchLogs],
  )
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
