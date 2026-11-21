'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense, type ComponentType } from 'react'
import { LiveDot } from '@/components/ui/Chip'
import { DotoValue } from '@/components/ui/DotoValue'
import { IconArrowUpRight, IconCopy, IconReceipt, IconShield, IconUser } from '@/components/ui/icons'
import { LogoMark } from '@/components/ui/Logo'
import { useToast } from '@/components/ui/Toast'
import { copyText, toCitizenError, type ReceiptsResponse } from '@/lib/data'
import { useOnline } from '@/lib/hooks'

type IconProps = { size?: number; strokeWidth?: number; className?: string }

const NAV: Array<{ href: string; label: string; Icon: ComponentType<IconProps>; match: (p: string) => boolean; away?: boolean }> = [
  { href: '/citizen', label: 'Receipts', Icon: IconReceipt, match: (p) => p === '/citizen' || p.startsWith('/citizen/receipt') },
  { href: '/proof', label: 'Verify', Icon: IconShield, match: (p) => p.startsWith('/proof'), away: true },
  { href: '/citizen/profile', label: 'Profile', Icon: IconUser, match: (p) => p.startsWith('/citizen/profile') },
]

export type SidebarWatch = 'watching' | 'paused' | 'offline' | 'none' | 'loading'

/**
 * Laptop sidebar for the citizen app (replaces the phone TabBar from 1024 px of shell width): logo, three
 * destinations, and the profile pinned at the bottom as a small vault chip with the code and the live
 * watch state. Purely presentational; `WorkspaceSidebar` feeds it from the shared ['receipts'] query.
 */
export function WorkspaceSidebarView({
  path,
  code,
  count,
  watch,
  onCopy,
}: {
  path: string
  code: string
  /** Receipts in this profile (badge on Receipts); undefined while unknown. */
  count?: number
  watch: SidebarWatch
  onCopy: () => void
}) {
  return (
    <aside
      aria-label="Citizen workspace"
      className="no-print hidden w-[216px] shrink-0 @7xl:w-[240px] flex-col border-r border-line bg-paper-2/55 @5xl:sticky @5xl:top-0 @5xl:flex @5xl:h-dvh"
    >
      <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
        <Link href="/" aria-label="Saksi home" className="flex min-h-10 items-center gap-2.5 rounded-sm">
          <LogoMark />
          <span className="text-[19px] font-semibold tracking-[-0.04em] text-ink">saksi</span>
        </Link>
        <span className="label border-l border-line pl-2.5 text-[11px] text-ink-2">Citizen</span>
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
                    active ? 'bg-card font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-ink-2 hover:bg-ink/[.05] hover:text-ink'
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2 : 1.75} className={active ? 'text-blue' : ''} />
                  <span className="flex-1">{label}</span>
                  {label === 'Receipts' && count !== undefined && count > 0 ? (
                    <span className="label tnum text-[11px] text-ink-2">{String(count).padStart(2, '0')}</span>
                  ) : null}
                  {away ? <IconArrowUpRight size={14} className="text-ink-3 group-hover:text-ink-2" /> : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="flex-1" />

      <div className="px-3 pb-4">
        {code ? (
          <div className="vault grain relative overflow-hidden rounded-lg border border-vault-line bg-vault">
            <div className="relative z-[1] px-3.5 pb-3 pt-3">
              <p className="label text-[11px] text-vault-ink-2">Your code</p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="text-[28px] leading-none text-vault-ink" aria-label={`Code ${code.split('').join(' ')}`}>
                  <DotoValue value={code} className="gap-[0.05em]" />
                </p>
                <button
                  type="button"
                  onClick={onCopy}
                  aria-label="Copy code"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-vault-ink-2 transition-colors duration-150 hover:bg-vault-ink/10 hover:text-vault-ink"
                >
                  <IconCopy size={15} />
                </button>
              </div>
            </div>
            <WatchLine watch={watch} />
          </div>
        ) : (
          <div className="rounded-lg border border-line px-3.5 py-3">
            <p className="text-[14px] font-medium text-ink">{watch === 'loading' ? 'Loading profile…' : 'No demo profile'}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
              {watch === 'loading' ? 'Checking this browser.' : 'Create one to get a code.'}
            </p>
          </div>
        )}
        <p className="label mt-3 px-1 text-[11px] text-ink-3">Synthetic demo</p>
      </div>
    </aside>
  )
}

function WatchLine({ watch }: { watch: SidebarWatch }) {
  const text = watch === 'watching' ? 'Watching · every 3 s' : watch === 'offline' ? 'Offline · paused' : 'Paused'
  return (
    <p role="status" className="label relative z-[1] flex items-center gap-2 border-t border-vault-line px-3.5 py-2.5 text-[11px] text-vault-ink-2">
      {watch === 'watching' ? <LiveDot tone="ice" /> : <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-dot" />}
      {text}
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
      onCopy={() => void onCopy()}
    />
  )
}
