'use client'

import { useSearchParams } from 'next/navigation'
import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { Chip, TwoTone } from '@/components/ui/Chip'
import { IconLock } from '@/components/ui/icons'
import { useToast } from '@/components/ui/Toast'
import { TxFlow, txErrorKind, txViewFromState } from '@/components/ui/TxStepper'
import { WalletGate, WalletStrip } from '@/components/ui/WalletGate'
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
    void runSeal({ controllerId, ...values })
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <TwoTone head="Record an access." tail="The citizen sees it in seconds." className="text-[34px] md:text-[48px]" />
        <div className="flex flex-wrap gap-2">
          {wallet.controller ? <Chip>{wallet.controller.name}</Chip> : null}
          <Chip icon={<IconLock size={12} />}>Pseudonym + fingerprint only</Chip>
        </div>
      </div>

      <div>
        <p className="label mb-2 text-ink-2">Wallet checks</p>
        <WalletStrip state={wallet.state} />
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <WalletGate wallet={wallet} onConnect={onConnect} onSwitchNetwork={onSwitchNetwork} onRefresh={onRefresh} onCopy={onCopy}>
            <RecordAccessForm
              controllerName={wallet.controller?.name ?? ''}
              initial={scannedCode ? { subjectCode: scannedCode } : undefined}
              busy={busy}
              onSeal={onSeal}
            />
          </WalletGate>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 lg:col-span-5">
          <section className="rounded-lg border border-line bg-card p-5" aria-label="Transaction">
            <div className="mb-5 flex items-center justify-between">
              <p className="label text-ink">Transaction</p>
              {tx.phase === 'confirmed' ? (
                <Badge kind="RECORDED" size="sm" />
              ) : busy || (tx.phase === 'error' && txErrorKind(tx.error, Boolean(tx.txHash)) === 'timeout') ? (
                <Badge kind="ON_CHAIN" size="sm" />
              ) : tx.phase === 'error' ? (
                <Badge kind="FAILED" size="sm" />
              ) : null}
            </div>
            <TxFlow tx={tx} onRetry={onRetry} onReconfirm={() => void onReconfirm()} />
          </section>

          <RecentReceipts
            status={recentStatus}
            rows={recent.data ?? []}
            error={recent.error?.message}
            onRetry={() => void recent.refetch()}
          />
        </aside>
      </div>
    </div>
  )
}
