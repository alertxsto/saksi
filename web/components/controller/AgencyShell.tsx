'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense, type ComponentType, type ReactNode } from 'react'
import { RoleChip } from '@/components/entry/RoleChip'
import { AppHeader } from '@/components/ui/AppHeader'
import { LogoMark } from '@/components/ui/Logo'
import { CHAIN_NAME, type WalletView } from '@/components/ui/WalletGate'
import { shortHex } from '@/lib/format'
import { IconBell, IconCheck, IconList, IconPen, IconPlug } from './agency-icons'
import '@/app/controller/agency.css'

type IconProps = { size?: number; strokeWidth?: number; className?: string }
type Item = { href: string; label: string; Icon: ComponentType<IconProps>; away?: boolean }

export const AGENCY_NAV: Item[] = [
  { href: '/controller', label: 'Record access', Icon: IconPen },
  { href: '/controller/log', label: 'Access log', Icon: IconList },
  { href: '/controller/breach', label: 'Breach notices', Icon: IconBell },
  { href: '/integrate', label: 'Connect your system', Icon: IconPlug, away: true },
]

function isActive(href: string, path: string) {
  if (href === '/controller') return path === '/controller'
  return path === href || path.startsWith(href + '/')
}

/** Plain-words status for the identity card under the name. */
function walletLine(w: WalletView): { text: string; tone: 'ok' | 'pending' | 'quiet' } {
  if (w.isChecking) return { text: 'Checking the registry…', tone: 'quiet' }
  switch (w.state) {
    case 'ready':
      return { text: `Registered on ${CHAIN_NAME}`, tone: 'ok' }
    case 'no_gas':
      return { text: 'Registered · fee needs top-up', tone: 'pending' }
    case 'not_registered':
      return { text: 'Not registered yet', tone: 'pending' }
    case 'wrong_network':
      return { text: `Switch to ${CHAIN_NAME}`, tone: 'pending' }
    case 'no_wallet':
      return { text: 'MetaMask not installed', tone: 'quiet' }
    default:
      return { text: 'Signature not connected', tone: 'quiet' }
  }
}

/**
 * Agency workspace frame (riset-ui/37 §4). ≥1024: a 232px sidebar (logo, agency identity read from the wallet,
 * four destinations, Switch role). <1024: the shared AppHeader (agency chip with the same identity, sheet menu).
 * Purely presentational: the controller layout feeds `wallet` from ControllerWalletProvider, the dev gallery
 * feeds fixtures.
 */
export function AgencyShellView({ wallet, path, children }: { wallet: WalletView; path: string; children: ReactNode }) {
  const name = wallet.controller?.name ?? null
  const line = walletLine(wallet)
  return (
    <div className="ag-root flex min-h-dvh bg-paper">
      <aside aria-label="Agency workspace" className="no-print sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-line bg-paper-2/55 lg:flex">
        <div className="flex items-center gap-2.5 px-5 pb-2 pt-5">
          <Link href="/" aria-label="Saksi home" className="flex min-h-10 items-center gap-2.5 rounded-sm">
            <LogoMark />
            <span className="text-[19px] font-semibold tracking-[-0.04em] text-ink">saksi</span>
          </Link>
          <span className="border-l border-line pl-2.5 text-[13px] leading-tight text-ink-2">Agency system<br />(simulated)</span>
        </div>

        <div className="mx-3 mt-4 rounded-[14px] bg-card p-3 shadow-[0_0_0_1px_var(--color-line)]">
          <div className="flex min-w-0 items-start gap-2.5">
            <span aria-hidden="true" className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-blue text-[12px] font-semibold text-white">
              A
            </span>
            <span className="min-w-0">
              <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-ink">{name ?? 'Your agency'}</span>
              <span className="mt-0.5 block font-mono text-[12px] text-ink-3">{wallet.address ? shortHex(wallet.address, 6, 4) : 'No signature yet'}</span>
            </span>
          </div>
          <p
            className={`mt-2.5 flex items-center gap-1.5 border-t border-line/70 pt-2.5 text-[12px] ${
              line.tone === 'ok' ? 'text-ok' : line.tone === 'pending' ? 'text-pending' : 'text-ink-2'
            }`}
          >
            {line.tone === 'ok' ? <IconCheck size={13} strokeWidth={2.6} /> : <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
            {line.text}
          </p>
        </div>

        <nav aria-label="Agency" className="px-3 pt-5">
          <ul className="flex flex-col gap-0.5">
            {AGENCY_NAV.map(({ href, label, Icon, away }) => {
              const active = !away && isActive(href, path)
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className="ag-nav-link group flex h-10 items-center gap-3 rounded-[10px] px-2.5 text-[15px] text-ink-2"
                  >
                    <Icon size={18} strokeWidth={active ? 2 : 1.75} />
                    <span className="flex-1 whitespace-nowrap">{label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex-1" />

        <div className="flex flex-col gap-2 border-t border-line px-4 pb-4 pt-3">
          <RoleChip actor="agency" identity={name} size="sm" />
          <Link
            href="/enter"
            className="flex h-10 items-center justify-center rounded-[10px] border border-line-strong text-[14px] font-medium text-ink transition-colors duration-150 hover:border-ink hover:bg-ink/[.04]"
          >
            Switch role
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="contents lg:hidden">
          <AppHeader actor="agency" identity={name} nav={AGENCY_NAV.map(({ href, label }) => ({ href, label }))} right={<WalletPill wallet={wallet} />} />
        </div>
        <main id="main" className="w-full min-w-0 px-4 pb-10 pt-6 md:px-8 lg:px-10 lg:pb-16 lg:pt-10">
          <div className="mx-auto w-full max-w-[1180px]">{children}</div>
        </main>
      </div>
    </div>
  )
}

/** Compact wallet status for the phone header sheet. */
export function WalletPill({ wallet }: { wallet: WalletView }) {
  const line = walletLine(wallet)
  return (
    <span className="inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-pill bg-card px-3 text-[13px] text-ink-2 shadow-[0_0_0_1px_var(--color-line)]">
      <span aria-hidden="true" className={`size-2 rounded-full ${line.tone === 'ok' ? 'bg-ok' : line.tone === 'pending' ? 'bg-pending' : 'bg-ink-3'}`} />
      {line.text}
      {wallet.address ? <span className="font-mono text-ink">{shortHex(wallet.address, 6, 4)}</span> : null}
    </span>
  )
}

function LivePath({ wallet, children }: { wallet: WalletView; children: ReactNode }) {
  return (
    <AgencyShellView wallet={wallet} path={usePathname() ?? ''}>
      {children}
    </AgencyShellView>
  )
}

export function AgencyShell({ wallet, children }: { wallet: WalletView; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <AgencyShellView wallet={wallet} path="">
          {children}
        </AgencyShellView>
      }
    >
      <LivePath wallet={wallet}>{children}</LivePath>
    </Suspense>
  )
}
