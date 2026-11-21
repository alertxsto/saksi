'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { AgencyShellView } from '@/components/controller/AgencyShell'
import type { TxView } from '@/components/ui/TxStepper'
import type { WalletView } from '@/components/ui/WalletGate'
import { RecordAccessView } from '@/app/controller/RecordAccess'
import { SCENARIOS } from '@/app/controller/RecordAccessForm'
import { fakeHex, mockWalletSnapshot } from '@/lib/mock'
import { AGENCY_GALLERY_EXTRA, type ExtraState } from './extra'

const noop = () => {}
export const AGENCY_NAME = 'Disdukcapil Kota Contoh (fiktif)'
const TX = fakeHex('gallery:tx')

export function agencyWallet(state: Parameters<typeof mockWalletSnapshot>[0] = 'ready', over: Partial<WalletView> = {}): WalletView {
  const w = mockWalletSnapshot(state)
  return { ...w, controller: w.controller ? { ...w.controller, name: AGENCY_NAME } : undefined, ...over }
}

const TXS: Record<string, TxView> = {
  idle: { phase: 'idle' },
  preparing: { phase: 'preparing' },
  signing: { phase: 'signing' },
  broadcast: { phase: 'broadcast', txHash: TX },
  confirmed: { phase: 'confirmed', txHash: TX, blockNumber: 7_123_242 },
  rejected: { phase: 'error', failedStep: 'signing', error: { code: 'USER_REJECTED', message: 'You rejected the request in your wallet.' } },
  timeout: { phase: 'error', failedStep: 'broadcast', txHash: TX, canReconfirm: true, error: { code: 'NOT_MINED', message: 'Not mined yet.' } },
}

const FILLED = { subjectCode: 'K7M2QD', ...SCENARIOS[1].values }

type State = { label: string; render: () => ReactNode; wallet?: WalletView }

function Record({ tx, filled = true, errors = false }: { tx: TxView; filled?: boolean; errors?: boolean }) {
  return (
    <RecordAccessView
      wallet={agencyWallet()}
      tx={tx}
      busy={tx.phase === 'preparing' || tx.phase === 'signing' || tx.phase === 'broadcast'}
      initialValues={filled ? FILLED : undefined}
      showErrors={errors}
      sealedAt={Date.now()}
      onSeal={noop}
      onRetry={noop}
      onReconfirm={noop}
    />
  )
}

/** Plays the seal from submit to "Citizen notified" so the motion can be filmed (frames at 0/150/400/800 ms). */
function RecordPlay() {
  const [tx, setTx] = useState<TxView>(TXS.idle)
  useEffect(() => {
    const steps: Array<[number, TxView]> = [
      [600, TXS.preparing],
      [1400, TXS.signing],
      [2200, TXS.broadcast],
      [3200, TXS.confirmed],
    ]
    const timers = steps.map(([ms, t]) => setTimeout(() => setTx(t), ms))
    return () => timers.forEach(clearTimeout)
  }, [])
  return <Record tx={tx} />
}

const walletStates = ['no_wallet', 'disconnected', 'wrong_network', 'not_registered', 'no_gas'] as const

export const STATES: Record<string, State> = {
  'record-empty': { label: 'Record · empty', render: () => <Record tx={TXS.idle} filled={false} /> },
  'record-errors': { label: 'Record · validation', render: () => <Record tx={TXS.idle} filled={false} errors /> },
  'record-filled': { label: 'Record · scenario applied', render: () => <Record tx={TXS.idle} /> },
  'record-preparing': { label: 'Record · prepared', render: () => <Record tx={TXS.preparing} /> },
  'record-signing': { label: 'Record · signing', render: () => <Record tx={TXS.signing} /> },
  'record-broadcast': { label: 'Record · sealing', render: () => <Record tx={TXS.broadcast} /> },
  'record-confirmed': { label: 'Record · sealed', render: () => <Record tx={TXS.confirmed} /> },
  'record-rejected': { label: 'Record · declined', render: () => <Record tx={TXS.rejected} /> },
  'record-timeout': { label: 'Record · slow network', render: () => <Record tx={TXS.timeout} /> },
  'record-play': { label: 'Record · play the seal', render: () => <RecordPlay /> },
  'wallet-checking': {
    label: 'Signature · checking',
    wallet: agencyWallet('disconnected', { isChecking: true }),
    render: () => (
      <RecordAccessView wallet={agencyWallet('disconnected', { isChecking: true })} tx={TXS.idle} busy={false} onSeal={noop} onRetry={noop} onReconfirm={noop} />
    ),
  },
  ...Object.fromEntries(
    walletStates.map((s) => [
      `wallet-${s}`,
      {
        label: `Signature · ${s.replace('_', ' ')}`,
        wallet: agencyWallet(s),
        render: () => <RecordAccessView wallet={agencyWallet(s)} tx={TXS.idle} busy={false} onSeal={noop} onRetry={noop} onReconfirm={noop} onCopy={noop} />,
      },
    ]),
  ),
  ...AGENCY_GALLERY_EXTRA,
}

const PATH: Record<string, string> = { log: '/controller/log', breach: '/controller/breach' }

/** /dev/states/controller?s=<state>: one agency state inside the real shell, for screenshots. No ?s: the index. */
export function ControllerGallery() {
  const s = useSearchParams().get('s')
  const state: State | ExtraState | undefined = s ? STATES[s] : undefined
  if (!state) {
    return (
      <main className="mx-auto max-w-[900px] px-4 py-10">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">Agency states</h1>
        <p className="mt-1 text-[15px] text-ink-2">Each opens inside the agency shell with fixtures.</p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {Object.entries(STATES).map(([k, v]) => (
            <li key={k}>
              <Link href={`?s=${k}`} className="flex h-11 items-center rounded-[12px] bg-card px-4 text-[15px] text-ink shadow-[0_0_0_1px_var(--color-line)] hover:shadow-[0_0_0_1px_var(--color-ink-2)]">
                {v.label}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    )
  }
  const area = s?.split('-')[0] ?? ''
  return (
    <AgencyShellView wallet={state.wallet ?? agencyWallet()} path={PATH[area] ?? '/controller'}>
      {state.render()}
    </AgencyShellView>
  )
}
