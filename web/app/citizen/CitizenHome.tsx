'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Chip, LiveDot, TwoTone } from '@/components/ui/Chip'
import { DotoValue } from '@/components/ui/DotoValue'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconAlert, IconClock, IconCopy, IconEye, IconLock, IconQr, IconReceipt, IconRefresh, IconShield, IconWifiOff } from '@/components/ui/icons'
import { ReceiptCard } from '@/components/ui/ReceiptCard'
import { RegMarks } from '@/components/ui/RegMarks'
import { ReceiptCardSkeleton } from '@/components/ui/Skeleton'
import { TabBar } from '@/components/ui/TabBar'
import { useToast } from '@/components/ui/Toast'
import { VaultSeal } from '@/components/ui/VaultSeal'
import { copyText, createProfile, getReceipts, toCitizenError, type CitizenError } from '@/lib/data'
import { timeBucket } from '@/lib/format'
import { useNow, useOnline } from '@/lib/hooks'
import type { ReceiptOpening } from '@/lib/shared/types'

// First time each receipt id was seen in this tab. Lives outside React so render stays pure.
const firstSeen = new Map<string, number>()
let primed = false

function track(receipts: ReceiptOpening[]) {
  const now = Date.now()
  let arrived: ReceiptOpening | null = null
  for (const r of receipts) {
    if (!firstSeen.has(r.eventId)) {
      firstSeen.set(r.eventId, primed ? now : 0)
      if (primed) arrived = r
    }
  }
  primed = true
  if (arrived && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(30)
}

const NEW_MS = 10_000

/** The session is an httpOnly cookie, so the receipts request decides: 401 SESSION_REQUIRED shows onboarding. */
export function CitizenHome() {
  return <ReceiptList />
}

// ---------------------------------------------------------------------------------------------
// C1 — onboarding
// ---------------------------------------------------------------------------------------------

/** Container: owns the create mutation (POST /api/citizen/session sets the session cookie). */
function Onboarding() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: createProfile,
    onSuccess: () => {
      firstSeen.clear()
      primed = false
      void qc.invalidateQueries({ queryKey: ['receipts'] })
      void qc.invalidateQueries({ queryKey: ['profile'] })
      toast('Synthetic profile created')
    },
  })

  const onCreateProfile = () => create.mutate()

  return (
    <OnboardingView
      status={create.isPending ? 'loading' : create.isError ? 'error' : 'idle'}
      error={create.isError ? toCitizenError(create.error) : null}
      onCreateProfile={onCreateProfile}
    />
  )
}

export type OnboardingStatus = 'idle' | 'loading' | 'error'

export function OnboardingView({
  status,
  error,
  onCreateProfile,
}: {
  status: OnboardingStatus
  error?: CitizenError | null
  onCreateProfile: () => void
}) {
  const loading = status === 'loading'
  const limited = status === 'error' && error?.code === 'RATE_LIMITED'
  return (
    // No tab bar here: cancel the shell's tab-bar padding so the sticky button bar sits flush at the bottom.
    <div className="-mb-[calc(5rem+env(safe-area-inset-bottom))] flex flex-1 flex-col">
      <div className="vault grain relative rounded-xl border border-vault-line bg-vault">
        <RegMarks className="bg-ice" />
        <div className="relative z-[1] mx-auto w-[78%] max-w-[300px] py-2">
          <VaultSeal grid={false} />
        </div>
        <p className="label absolute bottom-2.5 left-3 z-[1] text-[11px] text-vault-ink-2">
          <span className="text-ice">●</span> SEALED ON CHAIN
        </p>
      </div>

      <TwoTone as="h1" head="See who opened" tail="your data." className="mt-7 text-[40px]" />
      <p className="mt-3 text-[16px] leading-relaxed text-ink-2">
        Demo profile — no name, no ID number, no wallet. Companies log every access; you get a receipt and can check it
        yourself.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip>No names · no ID numbers</Chip>
        <Chip>Verified in your browser</Chip>
      </div>

      <ol className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {[
          ['01', 'SHOW', 'your code'],
          ['02', 'GET', 'a receipt'],
          ['03', 'VERIFY', 'on chain'],
        ].map(([n, k, v]) => (
          <li key={n} className="bg-card p-3">
            <p className="label text-[11px] text-blue">{n}</p>
            <p className="label mt-2 text-[12px] text-ink">{k}</p>
            <p className="text-[13px] text-ink-2">{v}</p>
          </li>
        ))}
      </ol>

      <div aria-hidden="true" className="min-h-6 flex-1" />
      {/* Sticky so a judge who just scanned the QR sees the one button without scrolling, even on short phones. */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-paper/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        {status === 'error' && error ? (
          <div
            role="alert"
            className={`mb-3 flex items-start gap-2.5 rounded-lg border p-3 text-[14px] ${
              limited ? 'border-pending/30 bg-pending-bg text-pending' : 'border-line-strong bg-card text-ink-2'
            }`}
          >
            {limited ? <IconClock size={17} className="mt-0.5 shrink-0" /> : <IconAlert size={17} className="mt-0.5 shrink-0" />}
            <span>
              <strong className="block font-semibold">
                {limited ? 'Too many profiles — wait a minute' : error.code === 'NETWORK' ? 'Can’t reach Saksi' : 'Couldn’t create a profile'}
              </strong>
              {error.message}
            </span>
          </div>
        ) : null}
        <Button variant="dark" size="lg" arrow full loading={loading} disabled={loading} onClick={onCreateProfile}>
          {loading ? 'Creating profile…' : status === 'error' ? 'Try again' : 'Create synthetic profile'}
        </Button>
        <p className="label mt-3 text-center text-[11px] text-ink-2">Takes 1 second · delete it anytime</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// C2 — receipts list (+ C2e states)
// ---------------------------------------------------------------------------------------------

function ProfileCard({ code, onCopy }: { code: string; onCopy: () => void }) {
  return (
    <section aria-label="Your profile code" className="vault grain relative flex items-stretch rounded-xl border border-vault-line bg-vault">
      <div className="relative z-[1] flex flex-1 flex-col justify-between gap-4 p-4">
        <p className="label text-[11px] text-vault-ink-2">
          PROFILE <span className="text-ice">{code || '······'}</span> · SYNTHETIC
        </p>
        <p className="text-[46px] leading-[0.9] text-vault-ink" aria-label={code ? `Code ${code.split('').join(' ')}` : 'Loading code'}>
          {code ? <DotoValue value={code} className="gap-[0.06em]" /> : '······'}
        </p>
        <button
          type="button"
          onClick={onCopy}
          disabled={!code}
          className="label flex min-h-11 w-fit items-center gap-2 rounded-md border border-vault-line px-3 text-[12px] text-vault-ink hover:border-ice hover:text-ice disabled:opacity-50"
        >
          <IconCopy size={14} /> Copy code
        </button>
      </div>
      <Link
        href="/citizen/profile"
        aria-label="Show your code as a QR to a company"
        className="group relative z-[1] w-[112px] shrink-0 rounded-r-xl border-l border-vault-line p-2"
      >
        <VaultSeal grid={false} boost={1.5} />
        <span aria-hidden="true" className="label mt-1 block text-center text-[11px] text-vault-ink-2 group-hover:text-ice">
          <IconQr size={11} className="mr-1 inline-block align-[-1px]" />
          SHOW TO A COMPANY
        </span>
      </Link>
    </section>
  )
}

export function OfflineBanner() {
  return (
    <p role="status" className="flex items-start gap-2.5 rounded-lg border border-pending/30 bg-pending-bg p-3 text-[14px] text-pending">
      <IconWifiOff size={17} className="mt-0.5 shrink-0" />
      You&apos;re offline — receipts will refresh when you&apos;re back.
    </p>
  )
}

/** Container: polls GET /api/citizen/receipts every 3 s while a profile exists. */
function ReceiptList() {
  const online = useOnline()
  const now = useNow()
  const { toast } = useToast()

  const q = useQuery({
    queryKey: ['receipts'],
    queryFn: async () => {
      const data = await getReceipts()
      track(data.receipts)
      return data
    },
    refetchInterval: (query) => (query.state.status === 'error' ? false : 3000),
    refetchIntervalInBackground: false,
    retry: (count, err) => toCitizenError(err).code !== 'NO_SESSION' && count < 1,
  })

  // No session cookie (401 SESSION_REQUIRED): offer to create a profile instead of an error.
  if (q.isError && toCitizenError(q.error).code === 'NO_SESSION') return <Onboarding />

  const receipts = q.data?.receipts ?? []
  const code = q.data?.profile.code ?? ''
  const freshIds = receipts
    .filter((r) => {
      const t = firstSeen.get(r.eventId)
      return !!t && !!now && now - t < NEW_MS
    })
    .map((r) => r.eventId)

  const onCopy = async () => {
    try {
      await copyText(code)
      toast('Copied')
    } catch {
      toast('Copy failed', 'bad')
    }
  }
  const onRetry = () => void q.refetch()

  return (
    <ReceiptListView
      state={q.isPending ? 'loading' : q.isError ? 'error' : receipts.length === 0 ? 'empty' : 'ready'}
      receipts={receipts}
      code={code}
      now={now}
      online={online}
      watching={online && !q.isError}
      freshIds={freshIds}
      error={q.isError ? toCitizenError(q.error).message : null}
      retrying={q.isFetching}
      onCopy={() => void onCopy()}
      onRetry={onRetry}
    />
  )
}

export type ReceiptListState = 'loading' | 'error' | 'empty' | 'ready'

const BUCKETS = ['NOW', 'TODAY', 'EARLIER'] as const

export function ReceiptListView({
  state,
  receipts,
  code,
  now,
  online,
  watching,
  freshIds,
  error,
  retrying,
  demoHint,
  onCopy,
  onRetry,
}: {
  state: ReceiptListState
  receipts: ReceiptOpening[]
  code: string
  now: number
  online: boolean
  /** Polling is active: shows "Watching · every 3 s" with a pulsing dot (static under reduced motion). */
  watching: boolean
  /** eventIds that arrived in the last 10 s: slide-in, blue border, "NEW · JUST ARRIVED". */
  freshIds: string[]
  error?: string | null
  retrying?: boolean
  demoHint?: boolean
  onCopy: () => void
  onRetry: () => void
}) {
  const fresh = receipts.filter((r) => freshIds.includes(r.eventId))
  const anchored = receipts.filter((r) => r.status === 'anchored').length

  return (
    <div className="flex flex-col gap-5">
      {!online ? <OfflineBanner /> : null}

      <ProfileCard code={code} onCopy={onCopy} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label flex items-center gap-2 text-ink">
          <LiveDot tone={watching ? 'blue' : 'pending'} ping={watching} />
          {watching ? 'Watching · every 3 s' : 'Paused'}
        </p>
        {state === 'ready' ? (
          <p className="label flex items-center gap-1.5 text-[11px] text-ok">
            <IconShield size={13} strokeWidth={2.2} />
            {anchored} on chain · {receipts.length} shown
          </p>
        ) : null}
      </div>

      {/* polite announcement for receipts that just arrived */}
      <p aria-live="polite" className="sr-only">
        {fresh.map((r) => `New receipt: ${r.controllerName} ${r.eventType === 3 ? 'shared' : 'accessed'} your data.`).join(' ')}
      </p>

      {state === 'loading' ? (
        <div className="flex flex-col gap-3" aria-label="Loading receipts">
          <ReceiptCardSkeleton />
          <ReceiptCardSkeleton />
          <ReceiptCardSkeleton />
        </div>
      ) : state === 'error' ? (
        <EmptyState
          tone="neutral"
          icon={<IconAlert size={20} />}
          title="Couldn't load your receipts"
          body={error ?? 'Something went wrong.'}
          action={
            <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry} loading={retrying}>
              Try again
            </Button>
          }
        />
      ) : state === 'empty' ? (
        <EmptyState
          icon={<IconReceipt size={20} />}
          title="No one has opened your data yet."
          body="Show your code to a company to try it. Receipts appear here within seconds."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {BUCKETS.map((b) => {
            const items = receipts.filter((r) => (now ? timeBucket(r.createdAt, now) : 'EARLIER') === b)
            if (items.length === 0) return null
            return (
              <section key={b} aria-label={b.toLowerCase()}>
                <div className="mb-2.5 flex items-center gap-3">
                  <span className={`label ${b === 'NOW' ? 'text-blue' : 'text-ink-2'}`}>{b}</span>
                  <span aria-hidden="true" className="h-px flex-1 bg-line" />
                  <span className="label tnum text-[11px] text-ink-2">{String(items.length).padStart(2, '0')}</span>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {items.map((r) => (
                    <li key={r.eventId}>
                      <ReceiptCard opening={r} now={now} isNew={freshIds.includes(r.eventId)} />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {demoHint ? (
        <p className="label flex items-center gap-2 text-[11px] text-ink-2">
          <IconEye size={13} /> Demo: a company opens your data in a few seconds…
        </p>
      ) : null}

      <section className="mt-2 border-t border-dashed border-line-strong pt-5">
        <h2 className="text-[16px] font-medium tracking-[-0.01em] text-ink">What a receipt proves</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          Each receipt is a fingerprint sealed on a public chain. If anyone edits the record later, your phone will see
          it. <Badge kind="RECORDED" size="sm" className="ml-1 align-middle" /> means sealed.
        </p>
        <p className="label mt-3 flex items-center gap-1.5 text-[11px] text-ink-2">
          <IconLock size={13} /> Only a fingerprint goes on chain · no names
        </p>
      </section>

      <TabBar />
    </div>
  )
}
