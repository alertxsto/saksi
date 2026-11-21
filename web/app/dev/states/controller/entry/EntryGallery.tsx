'use client'

import type { ReactNode } from 'react'
import { CitizenPanel, ControllerPanel, RegulatorPanel, type CitizenSession } from '@/components/entry/RolePanels'
import { WALLET_STATES, type WalletView } from '@/components/ui/WalletGate'
import { mockWalletSnapshot } from '@/lib/mock'

const noop = () => {}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <figcaption className="label border-b border-dashed border-line-strong pb-2 text-ink">{title}</figcaption>
      {children}
    </figure>
  )
}

const CITIZEN: [string, CitizenSession, { creating?: boolean; error?: string }?][] = [
  ['checking', { status: 'checking' }],
  ['no profile', { status: 'none' }],
  ['session found', { status: 'active', code: 'JV7K2M' }],
  ['creating', { status: 'none' }, { creating: true }],
  ['create failed', { status: 'unknown' }, { error: 'Could not create a profile right now. Check your connection and try again.' }],
]

/** Every /enter panel state with fixtures (the live page only shows what this browser has). */
export function EntryGallery() {
  const wallets: [string, WalletView][] = [
    ['checking', { state: 'disconnected', isChecking: true }],
    ...WALLET_STATES.map((s) => [s.replace('_', ' '), mockWalletSnapshot(s)] as [string, WalletView]),
    ['connecting', { ...mockWalletSnapshot('disconnected'), isConnecting: true }],
    ['registry check', { ...mockWalletSnapshot('not_registered'), isChecking: true }],
  ]
  return (
    <div className="flex flex-col gap-14">
      <section className="flex flex-col gap-6">
        <h2 className="text-[28px] font-medium tracking-[-0.02em] text-ink">Citizen</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {CITIZEN.map(([t, s, o]) => (
            <Frame key={t} title={t}>
              <CitizenPanel session={s} creating={o?.creating} error={o?.error} onCreateProfile={noop} />
            </Frame>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-6">
        <h2 className="text-[28px] font-medium tracking-[-0.02em] text-ink">Data controller (wallet sign-in)</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {wallets.map(([t, w]) => (
            <Frame key={t} title={t}>
              <ControllerPanel wallet={w} onConnect={noop} onSwitchNetwork={noop} onRefresh={noop} onCopy={noop} />
            </Frame>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-6">
        <h2 className="text-[28px] font-medium tracking-[-0.02em] text-ink">Regulator</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <Frame title="always open">
            <RegulatorPanel />
          </Frame>
        </div>
      </section>
    </div>
  )
}
