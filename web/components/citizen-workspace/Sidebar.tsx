'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense, type ComponentType } from 'react'
import { LiveDot } from '@/components/ui/Chip'
import { CitizenPass, type PassVerdict } from '@/components/citizen/CitizenPass'
import { passStatus } from '@/components/citizen/passStatus'
import { IconArrowUpRight, IconReceipt, IconShield, IconUser } from '@/components/ui/icons'
import { LogoMark } from '@/components/ui/Logo'
import { useToast } from '@/components/ui/Toast'
import { copyText, toCitizenError, type ReceiptsResponse } from '@/lib/data'
import { checkOf, useReceiptChecks } from '@/lib/client/receipt-checks'
import { useOnline } from '@/lib/hooks'
import { verdictKind } from '@/lib/receipt-state'

type IconProps = { size?: number; strokeWidth?: number; className?: string }

const NAV: Array<{ href: string; label: string; Icon: ComponentType<IconProps>; match: (p: string) => boolean; away?: boolean }> = [
  { href: '/citizen', label: 'Receipts', Icon: IconReceipt, match: (p) => p === '/citizen' || p.startsWith('/citizen/receipt') },
  { href: '/proof', label: 'Verify', Icon: IconShield, match: (p) => p.startsWith('/proof'), away: true },
  { href: '/citizen/profile', label: 'Profile', Icon: IconUser, match: (p) => p.startsWith('/citizen/profile') },
]

export type SidebarWatch = 'watching' | 'paused' | 'offline' | 'none' | 'loading'

/**
 * Laptop sidebar for the citizen app (replaces the phone TabBar from 1024 px of shell width): logo, three
 * destinations, and the profile pinned at the bottom as the compact Citizen Pass (verdict + code + QR)
 * and the live watch state. Purely presentational; `WorkspaceSidebar` feeds it from the shared ['receipts'] query.
 */
export function WorkspaceSidebarView({
  path,
  code,
  count,
  watch,
  verdict = 'empty',
  title,
  onCopy,
}: {
  path: string
  code: string
  /** Receipts in this profile (badge on Receipts); undefined while unknown. */
  count?: number
  watch: SidebarWatch
  /** Verdict on the compact pass; the container derives it from the phone's own chain checks. */
  verdict?: PassVerdict
  /** One line on the compact pass; defaults to the watch state. */
  title?: string
  onCopy: () => void
}) {
  return (
    <aside
      aria-label="Citizen workspace"
      className="no-print hidden w-[220px] shrink-0 flex-col border-r border-line bg-paper-2/55 @5xl:sticky @5xl:top-0 @5xl:flex @5xl:h-dvh"
    >
      <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
        <Link href="/" aria-label="Saksi home" className="flex min-h-10 items-center gap-2.5 rounded-sm">
          <LogoMark />
          <span className="text-[19px] font-semibold tracking-[-0.04em] text-ink">saksi</span>
        </Link>
        <span className="border-l border-line pl-2.5 text-[13px] text-ink-2">Citizen</span>
      </div>

      <nav aria-label="Citizen" className="px-3 pt-4">
        <ul className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, Icon, match, away }) => {
            const active = match(path)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex h-10 items-center gap-3 rounded-md px-2.5 text-[15px] transition-colors duration-150 ease-[cubic-bezier(.65,0,.2,1)] ${
                    active ? 'bg-ink font-medium text-paper' : 'text-ink-2 hover:bg-ink/[.05] hover:text-ink'
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2 : 1.75} />
                  <span className="flex-1">{label}</span>
                  {label === 'Receipts' && count !== undefined && count > 0 ? (
                    <span className={`tnum text-[13px] ${active ? 'text-paper/70' : 'text-ink-3'}`}>{count}</span>
                  ) : null}
                  {away ? <IconArrowUpRight size={14} className={active ? 'text-paper/70' : 'text-ink-3 group-hover:text-ink-2'} /> : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="flex-1" />

      <div className="px-3 pb-4">
        {code ? (
          <>
            <CitizenPass code={code} verdict={verdict} title={title ?? WATCH_TEXT[watch]} size="compact" onCopy={onCopy} />
            <WatchLine watch={watch} />
          </>
        ) : (
          <div className="rounded-[16px] bg-card px-3.5 py-3 shadow-[0_0_0_1px_var(--color-line)]">
            <p className="text-[14px] font-medium text-ink">{watch === 'loading' ? 'Loading profile…' : 'No profile yet'}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
              {watch === 'loading' ? 'Checking this browser.' : 'Create one to get a code.'}
            </p>
          </div>
        )}
        {code ? null : <p className="mt-2.5 px-1 text-[12px] text-ink-3">Synthetic profile</p>}
      </div>
    </aside>
  )
}

const WATCH_TEXT: Record<SidebarWatch, string> = {
  watching: 'Live · every 3 s',
  offline: 'Offline · paused',
  paused: 'Paused',
  none: 'Paused',
  loading: 'Loading…',
}

/** The watch state under the pass, one quiet line. */
function WatchLine({ watch }: { watch: SidebarWatch }) {
  return (
    <p role="status" className="mt-2.5 flex items-center gap-2 px-1 text-[12px] text-ink-3">
      {watch === 'watching' ? <LiveDot tone="blue" /> : <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-ink-3" />}
      {WATCH_TEXT[watch]} · synthetic profile
    </p>
  )
}

/**
 * Container: a passive observer of the receipts query (enabled: false), so it never fetches on its own and
 * never changes how the list polls; it shows whatever the page's query last loaded.
 */
export function WorkspaceSidebar() {
  return (
    <Suspense fallback={<LiveSidebar path="" />}>
      <PathSidebar />
    </Suspense>
  )
}

function PathSidebar() {
  return <LiveSidebar path={usePathname() ?? ''} />
}

function LiveSidebar({ path }: { path: string }) {
  const { toast } = useToast()
  const online = useOnline()
  const q = useQuery<ReceiptsResponse>({ queryKey: ['receipts'], enabled: false })
  const code = q.data?.profile.code ?? ''
  const noSession = q.isError && toCitizenError(q.error).code === 'NO_SESSION'
  const watch: SidebarWatch = noSession
    ? 'none'
    : !q.data
      ? q.isError
        ? 'none'
        : 'loading'
      : !online
        ? 'offline'
        : q.isError
          ? 'paused'
          : 'watching'

  // The compact pass reads the same in-browser chain checks the list does (no new state, no fetch).
  const store = useReceiptChecks()
  const receipts = q.data?.receipts ?? []
  const kinds = receipts.map((r) => verdictKind(checkOf(store.checks, r)))
  const pass = passStatus({
    state: !q.data ? (q.isError ? 'error' : 'loading') : receipts.length === 0 ? 'empty' : 'ready',
    total: receipts.length,
    matched: kinds.filter((k) => k === 'MATCH').length,
    checking: kinds.filter((k) => k === 'CHECKING').length,
    anchored: receipts.filter((r) => r.status === 'anchored').length,
    sealing: receipts.filter((r) => r.status === 'pending' || r.status === 'submitted').length,
    tampered: kinds.filter((k) => k === 'ALTERED').length + (q.data ? store.hidden.length : 0),
    watching: watch === 'watching',
  })

  const onCopy = async () => {
    try {
      await copyText(code)
      toast('Copied')
    } catch {
      toast('Copy failed', 'info')
    }
  }

  return (
    <WorkspaceSidebarView
      path={path}
      code={noSession ? '' : code}
      count={q.data?.receipts.length}
      watch={watch}
      verdict={pass.verdict}
      title={pass.title}
      onCopy={() => void onCopy()}
    />
  )
}
