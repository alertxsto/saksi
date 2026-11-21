'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AgencyPageHead, AgencyWalletPanel, SealStepper, type CarbonStatus } from '@/components/controller/AgencyKit'
import { IconArrowUpRight, IconPlug } from '@/components/controller/agency-icons'
import { useToast } from '@/components/ui/Toast'
import { txViewFromState, type TxView } from '@/components/ui/TxStepper'
import type { WalletView } from '@/components/ui/WalletGate'
import { useRecordAccess } from '@/lib/client/controller'
import type { TransactionState } from '@/lib/client/transactions'
import { getControllerRecent, type SealAccessInput } from '@/lib/data'
import { normalizeCitizenCode } from '@/lib/format'
import { RecordAccessForm, type AccessFormValues } from './RecordAccessForm'
import { useControllerWallet } from './wallet'

function ticketStatus(tx: TxView): CarbonStatus {
  if (tx.phase === 'confirmed') return 'sealed'
  if (tx.phase === 'idle') return 'draft'
  if (tx.phase === 'error') return tx.canReconfirm ? 'sealing' : 'stopped'
  return 'sealing'
}

/** The persistent framing note: this screen stands in for the agency's own system. */
export function SimulationNote() {
  return (
    <aside aria-label="About this screen" className="mb-6 flex items-start gap-3 rounded-[16px] bg-blue-bg/60 px-4 py-3.5 lg:mb-8">
      <span aria-hidden="true" className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-card text-blue">
        <IconPlug size={17} />
      </span>
      <p className="min-w-0 text-[14px] leading-relaxed text-ink">
        In production nobody fills this form. The agency’s system calls Saksi automatically every time an officer looks up a citizen
        (see{' '}
        <Link href="/integrate" className="inline-flex items-center gap-0.5 font-medium text-blue underline-offset-4 hover:underline">
          Connect your system <IconArrowUpRight size={12} />
        </Link>
        ). <span className="text-ink-2">This screen simulates one lookup.</span>
      </p>
    </aside>
  )
}

/** Presentational /controller: the dev gallery renders this with fixtures. */
export function RecordAccessView({
  wallet,
  tx,
  busy,
  initialCode,
  initialValues,
  sealedAt,
  showErrors,
  onSeal,
  onRetry,
  onReconfirm,
  onConnect,
  onSwitchNetwork,
  onRefresh,
  onCopy,
}: {
  wallet: WalletView
  tx: TxView
  busy: boolean
  initialCode?: string
  /** Gallery only: start with these values (a scenario applied). */
  initialValues?: Partial<AccessFormValues>
  sealedAt?: number | null
  showErrors?: boolean
  onSeal: (values: AccessFormValues) => void
  onRetry: () => void
  onReconfirm: () => void
  onConnect?: () => void
  onSwitchNetwork?: () => void
  onRefresh?: () => void
  onCopy?: (text: string) => void
}) {
  const ready = wallet.state === 'ready' && !wallet.isChecking
  const name = wallet.controller?.name ?? ''
  // On phones the stepper sits under the form: bring it into view once a seal starts.
  const stepRef = useRef<HTMLDivElement>(null)
  const started = tx.phase !== 'idle'
  useEffect(() => {
    if (started && window.matchMedia('(max-width: 1023px)').matches) stepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [started])

  return (
    <div>
      <AgencyPageHead
        title="Agency system (simulated)"
        description={
          ready ? (
            <>
              Simulate one officer looking up a citizen at <span className="font-medium text-ink">{name}</span>. Saksi witnesses it and the citizen’s phone gets the receipt.
            </>
          ) : (
            'Simulate one officer looking up a citizen. Saksi witnesses it and the citizen’s phone gets the receipt.'
          )
        }
      />
      <SimulationNote />
      {ready ? (
        <RecordAccessForm
          controllerName={name}
          initial={initialCode || initialValues ? { ...initialValues, ...(initialCode ? { subjectCode: initialCode } : {}) } : undefined}
          showErrors={showErrors}
          busy={busy}
          ticketStatus={ticketStatus(tx)}
          sealedAt={tx.phase === 'confirmed' ? sealedAt : null}
          onSeal={onSeal}
          aside={
            <div ref={stepRef} className="ag-group p-5">
              <p className="mb-4 text-[15px] font-semibold text-ink">
                {tx.phase === 'idle' ? 'When you press Sign and seal' : tx.phase === 'confirmed' ? 'Witnessed. The citizen has it.' : 'Sealing'}
              </p>
              <SealStepper tx={tx} onRetry={onRetry} onReconfirm={onReconfirm} />
            </div>
          }
        />
      ) : (
        <AgencyWalletPanel wallet={wallet} onConnect={onConnect} onSwitchNetwork={onSwitchNetwork} onRefresh={onRefresh} onCopy={onCopy} />
      )}
    </div>
  )
}

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
  const [sealedAt, setSealedAt] = useState<number | null>(null)

  // The access log reads the same query key, so a seal here refreshes it there.
  const recent = useQuery({
    queryKey: ['controller', 'recent', controllerId],
    queryFn: () => getControllerRecent(controllerId ?? '0x'),
    enabled: ready && Boolean(controllerId),
    retry: false,
  })

  const settle = (state: TransactionState, input: SealAccessInput) => {
    if (state.step === 'anchored') {
      setSealedAt(Date.now())
      toast(`Sealed · receipt on its way to ${input.subjectCode}`)
      void recent.refetch()
    } else if (state.step === 'failed') {
      if (state.error.code === 'rejected') toast('Signature declined · nothing left your office', 'bad')
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

  return (
    <RecordAccessView
      wallet={wallet}
      tx={tx}
      busy={busy}
      initialCode={scannedCode || undefined}
      sealedAt={sealedAt}
      onSeal={onSeal}
      onRetry={onRetry}
      onReconfirm={() => void onReconfirm()}
      onConnect={onConnect}
      onSwitchNetwork={onSwitchNetwork}
      onRefresh={onRefresh}
      onCopy={onCopy}
    />
  )
}
