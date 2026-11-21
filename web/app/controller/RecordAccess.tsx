'use client'

import { useSearchParams } from 'next/navigation'
import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ConsoleHead, MetaLine } from '@/components/controller/ConsoleHead'
import { TxChamber } from '@/components/controller/TxChamber'
import { useToast } from '@/components/ui/Toast'
import { txViewFromState } from '@/components/ui/TxStepper'
import { WalletGate } from '@/components/ui/WalletGate'
import { useRecordAccess } from '@/lib/client/controller'
import type { TransactionState } from '@/lib/client/transactions'
import { getControllerRecent, type SealAccessInput } from '@/lib/data'
import { normalizeCitizenCode } from '@/lib/format'
import { RecentReceipts } from './RecentReceipts'
import { RecordAccessForm, type AccessFormValues } from './RecordAccessForm'
import { useControllerWallet } from './wallet'

/**
 * /controller. Handlers: onSeal, onRetry, onReconfirm (+ wallet: onConnect, onSwitchNetwork,
 * onRefresh, onCopy from ./wallet). The transaction runs through useRecordAccess: prepare (server) →
 * sign (wallet) → submit with the submit token → wait for the receipt → confirm (server, with retries).
 */
export function RecordAccess() {
  const { wallet, onConnect, onSwitchNetwork, onRefresh, onCopy } = useControllerWallet()
  const ready = wallet.state === 'ready' && !wallet.isChecking
  const controllerId = wallet.controller?.id
  const { toast } = useToast()
  // ?code= comes from the citizen's profile QR: a phone camera opens this page with the code filled in.
  const scannedCode = normalizeCitizenCode(useSearchParams().get('code'))

  const access = useRecordAccess()
  const tx = txViewFromState(access.state)
  const busy = access.isBusy
  const lastInput = useRef<SealAccessInput | null>(null)

  const recent = useQuery({
    queryKey: ['controller', 'recent', controllerId],
    queryFn: () => getControllerRecent(controllerId ?? '0x'),
    enabled: ready && Boolean(controllerId),
    retry: false,
  })

  const settle = (state: TransactionState, input: SealAccessInput) => {
    if (state.step === 'anchored') {
      toast(`Sealed · receipt sent to ${input.subjectCode}`)
      void recent.refetch()
    } else if (state.step === 'failed') {
      if (state.error.code === 'rejected') toast('Signature rejected · nothing was sent', 'bad')
      // Pending, failed and submitted rows show up in the recent list too.
      void recent.refetch()
    }
  }

  const runSeal = async (input: SealAccessInput) => {
    lastInput.current = input
    // reset() refuses while a sent transaction is unsettled; that one needs Re-confirm, not a new signature.
    if (!access.reset()) return
    settle(await access.record(input), input)
  }

  const onSeal = (values: AccessFormValues) => {
    if (!controllerId || busy) return
    // An empty system field means "use our registered name", which the server fills in.
    void runSeal({ controllerId, ...values, system: values.system || undefined })
  }

  const onRetry = () => {
    if (lastInput.current && !busy) void runSeal(lastInput.current)
  }

  const onReconfirm = async () => {
    const input = lastInput.current
    if (!input || busy) return
    settle(await access.reconfirm(), input)
  }

  const recentStatus = !ready ? 'locked' : recent.isPending ? 'loading' : recent.isError ? 'error' : 'ready'

  return (
    <div className="flex flex-col gap-10 lg:gap-12">
      <ConsoleHead
        lead="Record an access."
        tail="The citizen sees it in seconds."
        aside={<MetaLine items={['Pseudonym + fingerprint only', 'Signed by your wallet']} />}
      >
        Each time your team opens a citizen’s data, write down what you did and why. Saksi seals its fingerprint on chain and
        the citizen’s phone gets the receipt.
      </ConsoleHead>

      <WalletGate wallet={wallet} onConnect={onConnect} onSwitchNetwork={onSwitchNetwork} onRefresh={onRefresh} onCopy={onCopy}>
        <RecordAccessForm
          controllerName={wallet.controller?.name ?? ''}
          initial={scannedCode ? { subjectCode: scannedCode } : undefined}
          busy={busy}
          previewStatus={tx.phase === 'confirmed' ? 'anchored' : 'pending'}
          onSeal={onSeal}
          aside={<TxChamber tx={tx} onRetry={onRetry} onReconfirm={() => void onReconfirm()} />}
        />
      </WalletGate>

      <RecentReceipts status={recentStatus} rows={recent.data ?? []} error={recent.error?.message} onRetry={() => void recent.refetch()} />
    </div>
  )
}
