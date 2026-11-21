'use client'

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'
import { Act } from '@/components/citizen/Act'
import { ReceiptsSplit } from '@/components/citizen-workspace/Split'
import { RiseHeading } from '@/components/citizen/motion'
import { GhostRow, IconChevron, ReceiptRow, TamperBanner } from '@/components/citizen/ReceiptRows'
import { LiveDot } from '@/components/ui/Chip'
import { DotIcon, type DotIconName } from '@/components/ui/DotIcon'
import { IconAlert, IconClock, IconCopy, IconEye, IconLock, IconRefresh, IconShield, IconSpinner, IconWifiOff } from '@/components/ui/icons'
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

/**
 * The one receipts query (GET /api/citizen/receipts, polled every 3 s). Shared by the list, the profile and
 * the laptop sidebar so they read one cache entry and every fetch still records first-seen times.
 */
export const receiptsQuery = queryOptions({
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

/**
 * The session is an httpOnly cookie, so the receipts request decides: 401 SESSION_REQUIRED shows onboarding.
 * `pane` (laptop detail side) and `focus` come from CitizenWorkspace; without a pane it is just the list.
 */
export function CitizenHome({ pane, focus = 'list', selectedId }: { pane?: ReactNode; focus?: 'list' | 'pane'; selectedId?: string }) {
  return <ReceiptList pane={pane} focus={focus} selectedId={selectedId} />
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
    // No tab bar here: cancel the shell's tab-bar padding so the sticky button bar sits flush at the bottom.
    // Laptop: two columns (story + action left, the vault right), vertically centred in the workspace.
    <div className="-mb-[calc(5rem+env(safe-area-inset-bottom))] flex flex-1 flex-col @5xl:mx-auto @5xl:mb-0 @5xl:grid @5xl:w-full @5xl:max-w-[1120px] @5xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @5xl:grid-rows-[1fr_auto_auto_auto_auto_1fr] @5xl:gap-x-16 @5xl:px-10 @5xl:py-12">
      <div className="vault grain relative overflow-hidden rounded-xl border border-vault-line bg-vault @5xl:col-start-2 @5xl:row-[1/-1] @5xl:flex @5xl:aspect-[5/6] @5xl:self-center @5xl:items-center @5xl:justify-center">
        <div className="relative z-[1] mx-auto w-[62%] max-w-[240px] py-1 @5xl:max-w-[380px]" aria-hidden="true">
          <VaultSeal grid={false} />
        </div>
        <p className="label absolute bottom-3 left-3.5 z-[1] flex items-center gap-1.5 text-[11px] text-vault-ink-2">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ice" /> Sealed on chain
        </p>
      </div>

      <RiseHeading as="h1" lead="See who opened" tail="your data." className="mt-7 text-[34px] leading-[1.04] @5xl:col-start-1 @5xl:row-start-2 @5xl:mt-0 @5xl:text-[56px]" />
      <p className="mt-3 text-[16px] @5xl:col-start-1 @5xl:row-start-3 @5xl:mt-5 @5xl:max-w-[46ch] @5xl:text-[17px] leading-[1.6] tracking-[0.01em] text-ink-2">
        A demo profile with no name, no ID number and no wallet. Every time a company opens your data you get a
        receipt you can check yourself.
      </p>

      <ul data-stagger="" className="mt-6 flex flex-col border-t border-line @5xl:col-start-1 @5xl:row-start-4 @5xl:mt-8">
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

      <div aria-hidden="true" className="min-h-6 flex-1 @5xl:hidden" />
      {/* Sticky so a judge who just scanned the QR sees the one button without scrolling, even on short phones. */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-paper/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md @5xl:static @5xl:col-start-1 @5xl:row-start-5 @5xl:mx-0 @5xl:max-w-[400px] @5xl:self-start @5xl:border-0 @5xl:bg-transparent @5xl:px-0 @5xl:pb-0 @5xl:pt-8 @5xl:backdrop-blur-none">
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
        <p className="label mt-3 text-center text-[11px] text-ink-2 @5xl:text-left">Takes 1 second · delete it anytime</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// C2 — receipts list (+ C2e states, + the red moment: banner, altered rows, deleted ghosts)
// ---------------------------------------------------------------------------------------------

/** Offline: neutral (red is for tampering only). Receipts stay on screen; polling pauses. */
export function OfflineBanner() {
  return (
    <p role="status" className="flex items-start gap-2.5 rounded-lg border border-line bg-card px-4 py-3 text-[14px] leading-relaxed text-ink-2">
      <IconWifiOff size={17} className="mt-0.5 shrink-0 text-ink" />
      <span>
        <strong className="font-semibold text-ink">You&apos;re offline.</strong> Receipts refresh when you&apos;re back.
      </span>
    </p>
  )
}

function RowSkeleton() {
  return (
    <div className="flex min-h-16 items-center gap-3 px-4" aria-hidden="true">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="cz-row-main flex flex-1 flex-col gap-2 py-4">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

/** Quiet state in an inset card: dot glyph (empty states keep the dot family), line, body, optional action. */
function Quiet({ glyph, title, body, action }: { glyph: DotIconName; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="anim-rise flex flex-col items-start gap-3 rounded-lg border border-line bg-card p-5">
      <DotIcon name={glyph} size={36} className="text-ink-3" />
      <div>
        <p className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">{title}</p>
        <div className="mt-1 text-[15px] leading-[1.55] text-ink-2">{body}</div>
      </div>
      {action}
    </div>
  )
}

const VERDICT = { CHECKING: 'verifying', MATCH: 'match', ALTERED: 'altered', NOT_FOUND: 'not_found' } as const

/** Container: polls GET /api/citizen/receipts every 3 s while a profile exists. */
function ReceiptList({ pane, focus, selectedId }: { pane?: ReactNode; focus: 'list' | 'pane'; selectedId?: string }) {
  const online = useOnline()
  const now = useNow()
  const { toast } = useToast()

  const q = useQuery(receiptsQuery)

  const receipts = q.data?.receipts ?? EMPTY_RECEIPTS
  const pseudonyms = q.data?.pseudonyms
  // Every sealed receipt is re-checked against the chain from this browser; nothing trusts the server.
  useAutoVerify(receipts, useMemo(() => pseudonyms?.map((p) => p.pseudonym) ?? [], [pseudonyms]))
  const store = useReceiptChecks()
  const verdicts: AutoVerdicts = {}
  for (const r of receipts) {
    const kind = verdictKind(checkOf(store.checks, r))
    // NOT FOUND only means something once the company says the receipt is sealed.
    if (kind && (kind !== 'NOT_FOUND' || r.status === 'anchored')) verdicts[r.eventId] = VERDICT[kind]
  }
  const ghosts = useGhostReceipts(q.data?.profile.code ?? '', receipts, verdicts, q.isSuccess)
  const ghostKeys = new Set(ghosts.map((g) => `${g.opening.txHash?.toLowerCase()}:${g.opening.logIndex}`))

  // No session cookie (401 SESSION_REQUIRED): offer to create a profile instead of an error.
  // An open receipt keeps its own "no profile" screen (ReceiptMissingView) instead.
  if (q.isError && toCitizenError(q.error).code === 'NO_SESSION') return focus === 'pane' && pane ? <>{pane}</> : <Onboarding />

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

  const list = (
    <ReceiptListView
      selectedId={selectedId}
      state={q.isPending ? 'loading' : q.isError ? 'error' : receipts.length === 0 ? 'empty' : 'ready'}
      receipts={receipts}
      code={code}
      now={now}
      online={online}
      watching={online && !q.isError}
      freshIds={freshIds}
      verdicts={verdicts}
      ghosts={ghosts}
      hiddenExtra={q.data ? store.hidden.filter((key) => !ghostKeys.has(key)).length : 0}
      error={q.isError ? toCitizenError(q.error).message : null}
      retrying={q.isFetching}
      onCopy={() => void onCopy()}
      onRetry={onRetry}
    />
  )
  return pane === undefined ? list : <ReceiptsSplit focus={focus} list={list} pane={pane} />
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
  hiddenExtra = 0,
  error,
  retrying,
  demoHint,
  selectedId,
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
  /** Sealed receipts found on chain for this profile that the company no longer shows and this phone has no copy of. */
  hiddenExtra?: number
  error?: string | null
  retrying?: boolean
  demoHint?: boolean
  /** Laptop master–detail: the receipt open in the pane (highlighted row). */
  selectedId?: string
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
  const matched = receipts.filter((r) => verdicts?.[r.eventId] === 'match').length
  const sealing = receipts.filter((r) => r.status === 'pending' || r.status === 'submitted').length
  const tamper = altered.length + lost.length + hiddenExtra > 0

  return (
    <div className="flex flex-col gap-6">
      {/* Large title + the code as a small chip (copy on tap). The laptop sidebar also carries the code. */}
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">Receipts</h1>
        <CodeChip code={code} onCopy={onCopy} />
      </header>

      {/* Status card first: the answer to "is my data OK?". Tamper keeps the existing red banner. */}
      <TamperBanner altered={altered.length} deleted={lost.length + hiddenExtra} checked={checked} href={altered[0] ? `/citizen/receipt/${altered[0]}?check=1` : null} />
      {!tamper && state === 'ready' ? (
        <StatusCard total={receipts.length} matched={matched} checking={checking} anchored={anchored} sealing={sealing} watching={watching} />
      ) : null}

      {!online ? <OfflineBanner /> : null}

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
        <section aria-label="Deleted records" className="flex flex-col gap-2.5">
          <h2 className="text-[15px] font-semibold text-ink">Missing from the database</h2>
          {lost.map((g) => (
            <GhostRow key={g.opening.eventId} ghost={g} now={now} />
          ))}
        </section>
      ) : null}

      {state === 'loading' ? (
        <div className="cz-group overflow-hidden rounded-lg border border-line bg-card" aria-label="Loading receipts">
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
        <Quiet
          glyph="eye"
          title="No one has opened your data yet"
          body={
            <>
              Show your code to a company to try it. Receipts appear here within seconds.
              <span className="mt-3 flex items-center gap-2 text-[14px] text-ink-3">
                {watching ? <LiveDot tone="blue" /> : null}
                {watching ? 'Watching for new receipts' : 'Paused'}
              </span>
            </>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {BUCKETS.map((b) => {
            const items = receipts.filter((r) => (now ? timeBucket(r.createdAt, now) : 'EARLIER') === b)
            if (items.length === 0) return null
            return (
              <section key={b} aria-labelledby={`bucket-${b}`}>
                <div className="flex items-baseline justify-between px-1 pb-2">
                  <h2 id={`bucket-${b}`} className="text-[15px] font-semibold text-ink">
                    {BUCKET_LABEL[b]}
                  </h2>
                  <span className="tnum text-[13px] text-ink-3">
                    {items.length} {items.length === 1 ? 'receipt' : 'receipts'}
                  </span>
                </div>
                <ul className="cz-group overflow-hidden rounded-lg border border-line bg-card">
                  {items.map((r) => (
                    <li key={r.eventId}>
                      <ReceiptRow opening={r} now={now} isNew={freshIds.includes(r.eventId)} verdict={verdicts?.[r.eventId]} selected={r.eventId === selectedId} />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {demoHint ? (
        <p className="flex items-center gap-2 text-[14px] text-ink-3">
          <IconEye size={14} /> Demo: a company opens your data in a few seconds…
        </p>
      ) : null}

      <details className="group rounded-lg border border-line bg-card">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2.5">
            <IconLock size={15} className="text-ink-2" /> What a receipt proves
          </span>
          <IconChevron size={16} className="text-ink-3 transition-transform duration-200 group-open:rotate-90" />
        </summary>
        <div className="border-t border-line px-4 pb-4 pt-3 text-[14px] leading-relaxed text-ink-2">
          <p>
            Each receipt is a fingerprint sealed on a public chain. If anyone edits the record later, your phone sees it
            and this screen turns red.
          </p>
          <p className="mt-2">
            A green check means your phone compared the record with the chain and it matches. Only a fingerprint goes on
            chain, never your name.
          </p>
        </div>
      </details>

      <TabBar />
    </div>
  )
}

const BUCKET_LABEL = { NOW: 'Just now', TODAY: 'Today', EARLIER: 'Earlier' } as const

/** The code as a small mono chip; tap copies. Hidden on the laptop, where the sidebar shows it. */
function CodeChip({ code, onCopy }: { code: string; onCopy: () => void }) {
  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={!code}
      aria-label={code ? `Copy your code ${code.split('').join(' ')}` : 'Loading code'}
      className="flex h-9 shrink-0 items-center gap-2 rounded-pill border border-line bg-card pl-3.5 pr-3 font-mono text-[14px] font-medium tracking-[0.06em] text-ink transition-colors duration-150 hover:border-line-strong disabled:opacity-50 @5xl:hidden"
    >
      {code || '······'}
      <IconCopy size={14} className="text-ink-3" />
    </button>
  )
}

/** Status card (riset-ui/35 home §2): one sentence about the whole profile, never red (red is the TamperBanner). */
function StatusCard({
  total,
  matched,
  checking,
  anchored,
  sealing,
  watching,
}: {
  total: number
  matched: number
  checking: number
  anchored: number
  sealing: number
  watching: boolean
}) {
  const all = matched > 0 && matched === anchored && checking === 0
  const title = checking
    ? `Checking ${checking} ${checking === 1 ? 'receipt' : 'receipts'} against the chain`
    : all
      ? `${anchored === total ? (total === 1 ? 'Your receipt matches' : `All ${total} receipts match`) : `${matched} of ${total} receipts match`} the chain`
      : matched
        ? `${matched} of ${anchored} sealed receipts match the chain`
        : sealing
          ? `${sealing} ${sealing === 1 ? 'receipt is' : 'receipts are'} being sealed`
          : `${total} ${total === 1 ? 'receipt' : 'receipts'} on record`
  const sub = checking
    ? 'Your phone is checking, not our server.'
    : matched
      ? 'Checked by your phone, not by Saksi’s server.'
      : 'Your phone checks each one once it is sealed.'
  return (
    <section aria-label="Receipts status" className="flex items-center gap-3.5 rounded-lg border border-line bg-card p-4">
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          checking ? 'bg-paper-2 text-ink-2' : matched ? 'bg-ok-bg text-ok' : sealing ? 'bg-pending-bg text-pending' : 'bg-paper-2 text-ink-2'
        }`}
      >
        {checking ? <IconSpinner size={18} /> : <IconShield size={20} strokeWidth={2} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-medium leading-snug text-ink">{title}</p>
        <p className="mt-0.5 text-[14px] leading-snug text-ink-2">{sub}</p>
        <p className="mt-1.5 flex items-center gap-2 text-[13px] text-ink-3">
          {watching ? <LiveDot tone="blue" /> : <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-ink-3" />}
          {watching ? 'Live · refreshes every 3 s' : 'Paused'}
        </p>
      </div>
    </section>
  )
}
