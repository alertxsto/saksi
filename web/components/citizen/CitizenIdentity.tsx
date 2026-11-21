'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { initials } from '@/components/citizen/ReceiptRows'
import type { ReceiptsResponse } from '@/lib/data'

/**
 * Who you are in the citizen app (riset-ui/37 §3): "Citizen · <name> (synthetic)" + Switch role.
 * Reads the shared ['receipts'] cache passively (enabled: false), so it never fetches or changes polling.
 * `name` overrides the cache (dev gallery).
 */
export function useCitizenName(name?: string): string | undefined {
  const q = useQuery<ReceiptsResponse>({ queryKey: ['receipts'], enabled: false })
  return name ?? q.data?.profile.displayName
}

/** The 4 px role accent: citizen is ink (agency blue, regulator green). */
function RoleTick() {
  return <span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full bg-ink" />
}

/** Phone header: role chip on the left of the Switch role link. Truncates the name, never the role. */
export function CitizenHeaderIdentity({ name: forced }: { name?: string }) {
  const name = useCitizenName(forced)
  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
      {name ? (
        <p className="flex min-w-0 items-center gap-2 text-[13px] leading-tight text-ink" title={`Citizen · ${name} (synthetic)`}>
          <RoleTick />
          <span className="truncate">
            <span className="text-ink-2">Citizen · </span>
            <span className="font-medium">{name}</span>
          </span>
          <span className="shrink-0 text-ink-3">(synthetic)</span>
        </p>
      ) : (
        <p className="flex items-center gap-2 text-[13px] text-ink-2">
          <RoleTick /> Citizen
        </p>
      )}
      <Link href="/enter" className="flex min-h-11 shrink-0 items-center text-[13px] font-medium text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-ink hover:decoration-ink">
        Switch role
      </Link>
    </div>
  )
}

/** Laptop sidebar footer: avatar, name, "Synthetic citizen", Switch role. */
export function CitizenSidebarIdentity({ name: forced }: { name?: string }) {
  const name = useCitizenName(forced)
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span aria-hidden="true" className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-[13px] font-semibold text-ink shadow-[0_0_0_1px_var(--color-line)]">
        {name ? initials(name) : '·'}
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-paper-2 bg-ink" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium leading-tight text-ink">{name ?? 'Citizen'}</p>
        <p className="mt-0.5 text-[12px] leading-tight text-ink-3">Synthetic citizen</p>
      </div>
      <Link
        href="/enter"
        className="shrink-0 rounded-pill px-2 py-1.5 text-[12px] font-medium text-ink-2 shadow-[0_0_0_1px_var(--color-line-strong)] transition-colors duration-150 hover:bg-ink hover:text-paper"
      >
        Switch
        <span className="sr-only"> role</span>
      </Link>
    </div>
  )
}
