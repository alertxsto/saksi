'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'
import { Act } from '@/components/citizen/Act'
import { RiseHeading, Scramble } from '@/components/citizen/motion'
import { GhostRow, ReceiptRow, TamperBanner } from '@/components/citizen/ReceiptRows'
import { Badge } from '@/components/ui/Badge'
import { LiveDot } from '@/components/ui/Chip'
import { DotIcon, type DotIconName } from '@/components/ui/DotIcon'
import { DotoValue } from '@/components/ui/DotoValue'
import { IconAlert, IconClock, IconCopy, IconEye, IconLock, IconRefresh, IconShield, IconWifiOff } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { TabBar } from '@/components/ui/TabBar'
import { useToast } from '@/components/ui/Toast'
import { VaultSeal } from '@/components/ui/VaultSeal'
import {
  alteredIds,
  copyText,
  createProfile,
  getReceipts,
  toCitizenError,
  type AutoVerdicts,
  type CitizenError,
  type GhostReceipt,
} from '@/lib/data'
import { checkOf, useAutoVerify, useReceiptChecks } from '@/lib/client/receipt-checks'
import { useGhostReceipts } from '@/lib/client/seen-receipts'
import { timeBucket } from '@/lib/format'
import { useNow, useOnline } from '@/lib/hooks'
import { verdictKind } from '@/lib/receipt-state'
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

const HOW: Array<[DotIconName, string, string]> = [
  ['eye', 'A company opens your data', 'They log it against your code'],
  ['shield', 'You get a sealed receipt', 'Its fingerprint goes on a public chain'],
  ['check', 'Your phone checks it', 'Not our server, not the company'],
]

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
    <div className="flex flex-1 flex-col">
      <div className="vault grain relative overflow-hidden rounded-xl border border-vault-line bg-vault">
        <div className="relative z-[1] mx-auto w-[62%] max-w-[240px] py-1" aria-hidden="true">
          <VaultSeal grid={false} />
        </div>
        <p className="label absolute bottom-3 left-3.5 z-[1] flex items-center gap-1.5 text-[11px] text-vault-ink-2">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ice" /> Sealed on chain
        </p>
      </div>

      <RiseHeading as="h1" lead="See who opened" tail="your data." className="mt-7 text-[34px] leading-[1.04]" />
      <p className="mt-3 text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2">
        A demo profile with no name, no ID number and no wallet. Every time a company opens your data you get a
        receipt you can check yourself.
      </p>

      <ul data-stagger="" className="mt-6 flex flex-col border-t border-line">
        {HOW.map(([g, k, v]) => (
          <li key={k} className="flex items-center gap-3.5 border-b border-line py-3">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-vault text-ice">
              <DotIcon name={g} size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-medium leading-snug text-ink">{k}</span>
              <span className="block text-[13px] text-ink-2">{v}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-7">
        {status === 'error' && error ? (
          <div role="alert" className="anim-rise mb-3 flex items-start gap-2.5 border-y border-line-strong py-3 text-[14px] text-ink-2">
            {limited ? <IconClock size={17} className="mt-0.5 shrink-0 text-ink" /> : <IconAlert size={17} className="mt-0.5 shrink-0 text-ink" />}
            <span>
              <strong className="block font-semibold text-ink">
                {limited ? 'Too many profiles — wait a minute' : error.code === 'NETWORK' ? 'Can’t reach Saksi' : 'Couldn’t create a profile'}
              </strong>
              {error.message}
            </span>
          </div>
        ) : null}
        <Act full loading={loading} disabled={loading} onClick={onCreateProfile}>
          {loading ? 'Creating profile…' : status === 'error' ? 'Try again' : 'Create synthetic profile'}
        </Act>
        <p className="label mt-3 text-center text-[11px] text-ink-2">Takes 1 second · delete it anytime</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// C2 — receipts list (+ C2e states, + the red moment: banner, altered rows, deleted ghosts)
// ---------------------------------------------------------------------------------------------

function ProfileCard({ code, onCopy }: { code: string; onCopy: () => void }) {
  return (
    <section aria-label="Your profile code" className="vault grain relative overflow-hidden rounded-xl border border-vault-line bg-vault">
      <div className="relative z-[1] p-4">
        <p className="label text-[11px] text-vault-ink-2">Your code · synthetic</p>
        <p className="mt-3 text-[48px] leading-[0.9] text-vault-ink" aria-label={code ? `Code ${code.split('').join(' ')}` : 'Loading code'}>
          {code ? <DotoValue value={code} className="gap-[0.06em]" /> : <span className="doto text-dot">······</span>}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="min-w-0 text-[14px] leading-snug text-vault-ink-2">Show it to a company. Every access comes back here.</p>
          <Act variant="vault" size="md" arrow={false} icon={<IconCopy size={14} />} disabled={!code} onClick={onCopy}>
            Copy
          </Act>
        </div>
      </div>
    </section>
  )
}

/** Offline: neutral (red is for tampering only). Receipts stay on screen; polling pauses. */
export function OfflineBanner() {
  return (
    <p role="status" className="flex items-start gap-2.5 border-y border-line-strong py-3 text-[14px] leading-relaxed text-ink-2">
      <IconWifiOff size={17} className="mt-0.5 shrink-0 text-ink" />
      <span>
        <strong className="font-semibold text-ink">You&apos;re offline.</strong> Receipts refresh when you&apos;re back.
      </span>
    </p>
  )
}

function RowSkeleton() {
  return (
    <div className="flex gap-3.5 border-b border-line py-4" aria-hidden="true">
      <Skeleton className="h-11 w-11 shrink-0 rounded-md" />
      <div className="flex flex-1 flex-col gap-2 pt-1">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="mt-1.5 h-7 w-28" />
      </div>
    </div>
  )
}

/** Quiet state on the paper: dot glyph, line, body, optional action. Hairlines, no box. */
function Quiet({ glyph, title, body, action }: { glyph: DotIconName; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="anim-rise flex flex-col items-start gap-3 border-y border-line py-6">
      <DotIcon name={glyph} size={40} className="text-ink-3" />
      <div>
        <p className="text-[19px] font-medium leading-snug tracking-[-0.015em] text-ink">{title}</p>
        <p className="mt-1 text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2">{body}</p>
      </div>
      {action}
    </div>
  )
}

const VERDICT = { CHECKING: 'verifying', MATCH: 'match', ALTERED: 'altered', NOT_FOUND: 'not_found' } as const

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

  const receipts = q.data?.receipts ?? EMPTY_RECEIPTS
  const pseudonyms = q.data?.pseudonyms
  // Every sealed receipt is re-checked against the chain from this browser; nothing trusts the server.
  useAutoVerify(receipts, useMemo(() => pseudonyms?.map((p) => p.pseudonym) ?? [], [pseudonyms]))
  const store = useReceiptChecks()
  const verdicts: AutoVerdicts = {}
  for (const r of receipts) {
    const kind = verdictKind(checkOf(store.checks, r))
    if (kind) verdicts[r.eventId] = VERDICT[kind]
  }
  const ghosts = useGhostReceipts(q.data?.profile.code ?? '', receipts, verdicts, q.isSuccess)

  // No session cookie (401 SESSION_REQUIRED): offer to create a profile instead of an error.
  if (q.isError && toCitizenError(q.error).code === 'NO_SESSION') return <Onboarding />

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
      toast('Copy failed', 'info')
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
      verdicts={verdicts}
      ghosts={ghosts}
      error={q.isError ? toCitizenError(q.error).message : null}
      retrying={q.isFetching}
      onCopy={() => void onCopy()}
      onRetry={onRetry}
    />
  )
}

export type ReceiptListState = 'loading' | 'error' | 'empty' | 'ready'

const BUCKETS = ['NOW', 'TODAY', 'EARLIER'] as const
const EMPTY_RECEIPTS: ReceiptOpening[] = []

export function ReceiptListView({
  state,
  receipts,
  code,
  now,
  online,
  watching,
  freshIds,
  verdicts,
  ghosts,
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
  /** eventIds that arrived in the last 10 s: slide-in, blue rail, scrambled "NEW · JUST ARRIVED". */
  freshIds: string[]
  /** Auto-verify result per eventId. 'altered' turns that row red (one flash + shake) and raises the banner. */
  verdicts?: AutoVerdicts
  /** Receipts this phone saw before that the database no longer returns: grey + red DELETED ghost cards. */
  ghosts?: GhostReceipt[]
  error?: string | null
  retrying?: boolean
  demoHint?: boolean
  onCopy: () => void
  onRetry: () => void
}) {
  const fresh = receipts.filter((r) => freshIds.includes(r.eventId))
  const anchored = receipts.filter((r) => r.status === 'anchored').length
  const altered = alteredIds(verdicts, receipts)
  const lost = ghosts ?? []
  const checking = receipts.filter((r) => verdicts?.[r.eventId] === 'verifying').length
  const checked = receipts.filter((r) => {
    const v = verdicts?.[r.eventId]
    return !!v && v !== 'verifying'
  }).length
  const tally = altered.length
    ? `${altered.length} altered · ${receipts.length} shown`
    : checking
      ? `checking ${checking} · ${receipts.length} shown`
      : `${anchored} on chain · ${receipts.length} shown`

  return (
    <div className="flex flex-col gap-5">
      <TamperBanner altered={altered.length} deleted={lost.length} checked={checked} href={altered[0] ? `/citizen/receipt/${altered[0]}?check=1` : null} />

      {!online ? <OfflineBanner /> : null}

      <ProfileCard code={code} onCopy={onCopy} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label flex items-center gap-2 text-ink">
          {watching ? <LiveDot tone="blue" /> : <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-ink-3" />}
          {watching ? 'Watching · every 3 s' : 'Paused'}
        </p>
        {state === 'ready' ? (
          <p className={`label flex items-center gap-1.5 text-[11px] ${altered.length ? 'text-bad' : 'text-ink-2'}`}>
            <IconShield size={13} strokeWidth={2.2} />
            <Scramble value={tally} />
          </p>
        ) : null}
      </div>

      {/* polite announcement for receipts that just arrived */}
      <p aria-live="polite" className="sr-only">
        {fresh.map((r) => `New receipt: ${r.controllerName} ${r.eventType === 3 ? 'shared' : 'accessed'} your data.`).join(' ')}
      </p>
      {/* assertive announcement when a chain check proves a receipt altered */}
      <p aria-live="assertive" className="sr-only">
        {receipts
          .filter((r) => altered.includes(r.eventId))
          .map((r) => `Receipt from ${r.controllerName} was altered: it no longer matches the chain.`)
          .join(' ')}
      </p>

      {lost.length ? (
        <div className="flex flex-col gap-2.5">
          {lost.map((g) => (
            <GhostRow key={g.opening.eventId} ghost={g} now={now} />
          ))}
        </div>
      ) : null}

      {state === 'loading' ? (
        <div className="flex flex-col border-t border-line" aria-label="Loading receipts">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : state === 'error' ? (
        <Quiet
          glyph="clock"
          title="Couldn't load your receipts"
          body={error ?? 'Something went wrong.'}
          action={
            <Act variant="light" size="md" icon={<IconRefresh size={15} />} onClick={onRetry} loading={retrying}>
              Try again
            </Act>
          }
        />
      ) : state === 'empty' ? (
        <Quiet glyph="eye" title="No one has opened your data yet." body="Show your code to a company to try it. Receipts appear here within seconds." />
      ) : (
        <div className="flex flex-col gap-4">
          {BUCKETS.map((b) => {
            const items = receipts.filter((r) => (now ? timeBucket(r.createdAt, now) : 'EARLIER') === b)
            if (items.length === 0) return null
            return (
              <section key={b} aria-label={b.toLowerCase()}>
                <div className="flex items-center gap-3 pb-1">
                  <span className={`label ${b === 'NOW' ? 'text-blue' : 'text-ink-2'}`}>{b}</span>
                  <span aria-hidden="true" className="h-px flex-1 bg-line" />
                  <span className="label tnum text-[11px] text-ink-2">
                    <Scramble value={String(items.length).padStart(2, '0')} />
                  </span>
                </div>
                <ul className="flex flex-col">
                  {items.map((r) => (
                    <li key={r.eventId} className="border-b border-line last:border-b-0">
                      <ReceiptRow opening={r} now={now} isNew={freshIds.includes(r.eventId)} verdict={verdicts?.[r.eventId]} />
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

      <section className="mt-3 border-t border-line pt-5">
        <h2 className="text-[19px] font-medium leading-snug tracking-[-0.015em] text-ink">What a receipt proves</h2>
        <p className="mt-2 text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2">
          Each receipt is a fingerprint sealed on a public chain. If anyone edits the record later, your phone sees it
          and this screen turns red. <Badge kind="RECORDED" size="sm" className="ml-0.5 align-middle" /> means sealed.
        </p>
        <p className="label mt-3 flex items-center gap-1.5 text-[11px] text-ink-2">
          <IconLock size={13} /> Only a fingerprint goes on chain · no names
        </p>
      </section>

      <TabBar />
    </div>
  )
}
