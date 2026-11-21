'use client'

import { EnterHeader } from '@/components/entry/EnterHeader'
import { EnterLayout } from '@/components/entry/EnterView'
import { CitizenPanel, ControllerPanel, type CitizenSession } from '@/components/entry/RolePanels'
import type { DoorKey } from '@/components/entry/RoleChip'
import { AppHeader } from '@/components/ui/AppHeader'
import { Chip } from '@/components/ui/Chip'
import { IconShield } from '@/components/ui/icons'
import type { WalletView } from '@/components/ui/WalletGate'
import { mockWalletSnapshot } from '@/lib/mock'

const noop = () => {}

type Gate = { citizen: CitizenSession; wallet: WalletView; as?: DoorKey; creating?: boolean; error?: string }

/** /enter fixtures: the live page only shows what this browser has. */
export const GATES: Record<string, Gate> = {
  new: { citizen: { status: 'none' }, wallet: mockWalletSnapshot('disconnected') },
  returning: { citizen: { status: 'active', code: 'K7M2QD', name: 'Irawanti Usada' }, wallet: mockWalletSnapshot('ready') },
  checking: { citizen: { status: 'checking' }, wallet: { state: 'disconnected', isChecking: true } },
  'as-agency': { citizen: { status: 'none' }, wallet: mockWalletSnapshot('wrong_network'), as: 'agency' },
  'as-citizen': { citizen: { status: 'none' }, wallet: mockWalletSnapshot('no_wallet'), as: 'citizen' },
  'not-registered': { citizen: { status: 'unknown' }, wallet: mockWalletSnapshot('not_registered') },
  creating: { citizen: { status: 'active', code: 'K7M2QD', name: 'Irawanti Usada' }, wallet: mockWalletSnapshot('disconnected'), creating: true },
  error: {
    citizen: { status: 'none' },
    wallet: mockWalletSnapshot('disconnected'),
    error: 'Could not create a citizen right now. Check your connection and try again.',
  },
}

export const HEADERS = ['header-agency', 'header-agency-anon', 'header-regulator', 'header-verifier'] as const

export function EntryStates({ s }: { s: string }) {
  if (s.startsWith('header-')) return <HeaderState s={s} />
  const g = GATES[s] ?? GATES.new
  return (
    <>
      <EnterHeader />
      <main id="main" className="pb-16 pt-6 md:pb-20 md:pt-10">
        <div className="ws max-w-[1240px]!">
          <EnterLayout
            as={g.as}
            citizen={<CitizenPanel session={g.citizen} creating={g.creating} error={g.error} onCreateProfile={noop} />}
            controller={<ControllerPanel wallet={g.wallet} onConnect={noop} onSwitchNetwork={noop} onRefresh={noop} onCopy={noop} />}
          />
        </div>
      </main>
    </>
  )
}

const NAV_AGENCY = [
  { href: '/dev/states/entry', label: 'Record access' },
  { href: '/controller/breach', label: 'Breach notice' },
]
const NAV_REG = [
  { href: '/dev/states/entry', label: 'Register' },
  { href: '/regulator/reports', label: 'Citizen reports' },
  { href: '/regulator/controllers', label: 'Agencies' },
]

function HeaderState({ s }: { s: string }) {
  const header =
    s === 'header-regulator' ? (
      <AppHeader frame actor="regulator" nav={NAV_REG} right={<Chip icon={<IconShield size={12} />} tone="ink">Read-only</Chip>} />
    ) : s === 'header-verifier' ? (
      <AppHeader frame role="Public verifier" area="proof" />
    ) : s === 'header-agency-anon' ? (
      <AppHeader frame role="Controller console" area="controller" nav={NAV_AGENCY} />
    ) : (
      <AppHeader frame actor="agency" identity="Disdukcapil Kota Contoh (fiktif)" nav={NAV_AGENCY} right={<Chip tone="ok">Sepolia · registered</Chip>} />
    )
  return (
    <>
      {header}
      <main id="main" className="pb-24 pt-8 md:pt-12">
        <div className="ws">
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">Page title</h1>
          <p className="mt-1 text-[15px] text-ink-2">Content under the shared header.</p>
          <div className="mt-6 h-[1400px] rounded-2xl border border-line bg-card" />
        </div>
      </main>
    </>
  )
}
