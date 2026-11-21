'use client'

import { useRouter } from 'next/navigation'
import { Suspense, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ControllerWalletProvider, useControllerWallet } from '@/app/controller/wallet'
import { createProfile, getReceipts, toCitizenError } from '@/lib/data'
import { AnyoneRow, CitizenPanel, ControllerPanel, RegulatorPanel, type CitizenSession } from './RolePanels'
import { RealLifeStrip } from './RealLifeStrip'
import type { DoorKey } from './RoleChip'
import './entry.css'

/** /enter: the role gate. Containers here; the doors are pure views. `as` pre-selects a door (?as=agency). */
export function EnterView({ as }: { as?: DoorKey }) {
  return (
    <EnterLayout
      as={as}
      citizen={<CitizenEntry />}
      controller={
        <Suspense fallback={<ControllerPanel wallet={{ state: 'disconnected', isChecking: true }} onConnect={noop} onSwitchNetwork={noop} onRefresh={noop} onCopy={noop} />}>
          <ControllerWalletProvider>
            <ControllerEntry />
          </ControllerWalletProvider>
        </Suspense>
      }
    />
  )
}

const noop = () => {}

/**
 * Page frame shared with the dev gallery: title, the real-life strip, the three doors, the "anyone" row.
 * Selection feedback: the door whose action you press is marked [data-picked] and the other two step back.
 * A pre-selected door (?as=) is marked [data-suggested] and scrolled into view on phones.
 */
export function EnterLayout({ citizen, controller, as }: { citizen: ReactNode; controller: ReactNode; as?: DoorKey }) {
  const [picked, setPicked] = useState<DoorKey | null>(null)
  const doorsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!as || window.matchMedia('(min-width: 1024px)').matches) return
    const el = doorsRef.current?.querySelector(`[data-slot="${as}"]`)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = window.setTimeout(() => el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 360)
    return () => window.clearTimeout(t)
  }, [as])

  const pick = (key: DoorKey) => (e: MouseEvent) => {
    if ((e.target as Element).closest('a[href]:not([target]), button:not(:disabled)')) setPicked(key)
  }

  const slot = (key: DoorKey, node: ReactNode) => (
    <div
      data-slot={key}
      data-picked={picked === key ? '' : undefined}
      data-suggested={!picked && as === key ? '' : undefined}
      onClickCapture={pick(key)}
      className="en-slot min-w-0"
    >
      {node}
    </div>
  )

  return (
    <div className="flex flex-col gap-7 md:gap-8">
      <header className="en-head flex flex-col gap-3">
        <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink md:text-[44px]">Who are you today?</h1>
        <p className="max-w-[60ch] text-[16px] leading-[1.55] text-ink-2 md:text-[17px]">
          Saksi is the witness between the agencies that hold your data and you. Pick a seat: all three see the same sealed record.
        </p>
      </header>

      <RealLifeStrip />

      <div ref={doorsRef} data-picking={picked ? '' : undefined} className="en-doors grid gap-4 md:gap-5 lg:grid-cols-3">
        {slot('citizen', citizen)}
        {slot('agency', controller)}
        {slot('regulator', <RegulatorPanel />)}
      </div>
      <AnyoneRow />
    </div>
  )
}

function CitizenEntry() {
  const router = useRouter()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const receipts = useQuery({ queryKey: ['enter', 'citizen-session'], queryFn: getReceipts, retry: false })

  const session: CitizenSession = receipts.isPending
    ? { status: 'checking' }
    : receipts.data
      ? { status: 'active', code: receipts.data.profile.code, name: receipts.data.profile.displayName }
      : toCitizenError(receipts.error).code === 'NO_SESSION'
        ? { status: 'none' }
        : { status: 'unknown' }

  const onCreateProfile = async () => {
    if (creating) return
    setCreating(true)
    setError(null)
    try {
      await createProfile()
      // the citizen app keeps its own ['receipts'] / ['profile'] caches; a fresh session must not reuse a cached 401
      qc.removeQueries({ queryKey: ['receipts'] })
      qc.removeQueries({ queryKey: ['profile'] })
      router.push('/citizen')
    } catch (err) {
      const e = toCitizenError(err)
      setError(
        e.code === 'RATE_LIMITED'
          ? 'Too many new citizens from this network. Wait a minute and try again.'
          : 'Could not create a citizen right now. Check your connection and try again.',
      )
      setCreating(false)
    }
  }

  return <CitizenPanel session={session} creating={creating} error={error} onCreateProfile={() => void onCreateProfile()} />
}

function ControllerEntry() {
  const { wallet, onConnect, onSwitchNetwork, onRefresh, onCopy } = useControllerWallet()
  return <ControllerPanel wallet={wallet} onConnect={onConnect} onSwitchNetwork={onSwitchNetwork} onRefresh={onRefresh} onCopy={onCopy} />
}
