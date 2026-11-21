'use client'

import { useRouter } from 'next/navigation'
import { Suspense, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RiseHeading } from '@/components/regulator/Rise'
import { ControllerWalletProvider, useControllerWallet } from '@/app/controller/wallet'
import { createProfile, getReceipts, toCitizenError } from '@/lib/data'
import { AnyoneRow, CitizenPanel, ControllerPanel, RegulatorPanel, type CitizenSession } from './RolePanels'

/** /enter: the three points of view side by side. Containers here; the panels are pure views. */
export function EnterView() {
  return (
    <EnterLayout
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

/** Page frame shared with the dev gallery: two-tone heading + paragraph, the three panels, the "anyone" row. */
export function EnterLayout({ citizen, controller }: { citizen: ReactNode; controller: ReactNode }) {
  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <header className="grid gap-6 lg:grid-cols-12 lg:items-end">
        <RiseHeading
          as="h1"
          lead="Sign in to Saksi."
          tail="Pick the side you are on."
          className="text-[34px] leading-[1.04] md:text-[56px] lg:col-span-7"
        />
        <p className="max-w-[46ch] text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[17px] lg:col-span-4 lg:col-start-9">
          Saksi stands between the people who hold personal data and the people it is about. Each side sees the same chain
          from its own seat.
        </p>
      </header>
      <div className="grid gap-4 md:gap-5 lg:grid-cols-3">
        {citizen}
        {controller}
        <RegulatorPanel />
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
      ? { status: 'active', code: receipts.data.profile.code }
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
          ? 'Too many new profiles from this network. Wait a minute and try again.'
          : 'Could not create a profile right now. Check your connection and try again.',
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
