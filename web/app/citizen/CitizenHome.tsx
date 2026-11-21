'use client'

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Act } from '@/components/citizen/Act'
import { ReceiptsSplit } from '@/components/citizen-workspace/Split'
import { RiseHeading } from '@/components/citizen/motion'
import { CitizenPass, type PassVerdict } from '@/components/citizen/CitizenPass'
import { passStatus } from '@/components/citizen/passStatus'
import { GhostRow, IconChevron, ReceiptRow, TamperBanner } from '@/components/citizen/ReceiptRows'
import { HowSaksiWitnesses, IdentitySheet, useFirstRun } from '@/components/citizen/WitnessSheet'
import { DotIcon, type DotIconName } from '@/components/ui/DotIcon'
import { IconAlert, IconCheck, IconClock, IconEye, IconLock, IconRefresh, IconShield, IconSpinner, IconWifiOff, IconX } from '@/components/ui/icons'
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
import './stub-list.css'
import './witness.css'

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
  ['eye', 'An agency records the access', 'Who, why and under which legal basis'],
  ['shield', 'Saksi seals it on a public ledger', 'A neutral witness; Saksi never holds your data'],
  ['check', 'Your phone checks it', 'So nobody can quietly change it later'],
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
    // Laptop: two columns (story + action left, the blank pass right), vertically centred in the workspace.
    <div className="-mb-[calc(5rem+env(safe-area-inset-bottom))] flex flex-1 flex-col @5xl:mx-auto @5xl:mb-0 @5xl:grid @5xl:w-full @5xl:max-w-[1120px] @5xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @5xl:grid-rows-[1fr_auto_auto_auto_auto_1fr] @5xl:gap-x-16 @5xl:px-10 @5xl:py-12">
      {/* The pass you are about to get: a blank vault ticket, the seal on top, an empty code on the tear-off. */}
      <div aria-hidden="true" className="sl-shadow sl-rise @5xl:col-start-2 @5xl:row-[1/-1] @5xl:self-center">
        <div className="sl-ticket grain relative overflow-hidden rounded-t-xl bg-vault" style={{ '--notch': '100%' } as CSSProperties}>
          <div className="relative z-[1] mx-auto w-[52%] max-w-[200px] py-5 @5xl:w-[62%] @5xl:max-w-[320px] @5xl:py-12">
            <VaultSeal grid={false} />
          </div>
        </div>
        <div className="sl-ticket grain relative flex items-end justify-between gap-4 overflow-hidden rounded-b-xl bg-vault px-5 pb-5 pt-4" style={{ '--notch': '0%' } as CSSProperties}>
          <span className="sl-perf absolute left-5 right-5 top-0 z-[1] text-vault-ink-2/50" />
          <span className="relative z-[1] min-w-0">
            <span className="block text-[13px] text-vault-ink-2">Your code</span>
            <span className="doto mt-1 block text-[30px] tracking-[0.06em] text-vault-ink-2/60">······</span>
          </span>
          <span className="relative z-[1] flex shrink-0 items-center gap-1.5 pb-1 text-[13px] text-vault-ink-2">
            Witnessed by Saksi
          </span>
        </div>
      </div>

      <RiseHeading as="h1" lead="See who opened" tail="your data." className="mt-7 text-[34px] leading-[1.04] @5xl:col-start-1 @5xl:row-start-2 @5xl:mt-0 @5xl:text-[56px]" />
      <p className="mt-3 text-[16px] @5xl:col-start-1 @5xl:row-start-3 @5xl:mt-5 @5xl:max-w-[46ch] @5xl:text-[17px] leading-[1.6] tracking-[0.01em] text-ink-2">
        A synthetic profile with no name, no ID number and no wallet. Every time a company opens your data you get a
        receipt you can check yourself.
      </p>

      {/* How it works, as three small stubs: the glyph on the torn-off side, the step on the body. */}
      <ul data-stagger="" className="mt-6 flex flex-col gap-2 @5xl:col-start-1 @5xl:row-start-4 @5xl:mt-8 @5xl:max-w-[460px]">
        {HOW.map(([g, k, v]) => (
          <li key={k} className="sl-shadow-sm">
            <div className="sl-stub relative flex min-h-[64px] items-stretch rounded-[16px] bg-card" style={{ '--cut': '60px' } as CSSProperties}>
              <span aria-hidden="true" className="flex w-[60px] shrink-0 items-center justify-center text-ink">
                <DotIcon name={g} size={22} />
              </span>
              <span aria-hidden="true" className="sl-perf-v absolute bottom-3 left-[59px] top-3 text-line-strong" />
              <span className="flex min-w-0 flex-col justify-center py-3 pl-4 pr-4">
                <span className="block text-[15px] font-semibold leading-snug text-ink">{k}</span>
                <span className="block text-[13px] leading-snug text-ink-2">{v}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div aria-hidden="true" className="min-h-6 flex-1 @5xl:hidden" />
      {/* Sticky so a judge who just scanned the QR sees the one button without scrolling, even on short phones. */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-paper/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md @5xl:static @5xl:col-start-1 @5xl:row-start-5 @5xl:mx-0 @5xl:max-w-[400px] @5xl:self-start @5xl:border-0 @5xl:bg-transparent @5xl:px-0 @5xl:pb-0 @5xl:pt-8 @5xl:backdrop-blur-none">
        {status === 'error' && error ? (
          <div role="alert" className="anim-rise mb-3 flex items-start gap-2.5 rounded-[14px] bg-card px-3.5 py-3 text-[14px] text-ink-2 shadow-[0_0_0_1px_var(--color-line)]">
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
        <p className="mt-3 text-center text-[13px] text-ink-2 @5xl:text-left">Takes 1 second · delete it anytime</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// C2 — receipts list (+ C2e states, + the red moment: banner, altered rows, deleted ghosts)
// ---------------------------------------------------------------------------------------------

/**
 * Stub shell for the quiet states (empty, error, offline, loading): the same ticket as a receipt row, with
 * a glyph on the torn-off side instead of the time. Never red (red is tampering only).
 */
function QuietStub({ side, children, className = '' }: { side: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`sl-shadow-sm ${className}`}>
      <div className="sl-stub relative flex min-h-[72px] items-stretch rounded-[16px] bg-card">
        <span aria-hidden="true" className="flex w-[74px] shrink-0 items-center justify-center text-ink-3">
          {side}
        </span>
        <span aria-hidden="true" className="sl-perf-v absolute bottom-3 left-[73px] top-3 text-line-strong" />
        <div className="flex min-w-0 flex-1 flex-col justify-center py-3.5 pl-4 pr-4">{children}</div>
      </div>
    </div>
  )
}

/** Offline: neutral (red is for tampering only). Receipts stay on screen; polling pauses. */
export function OfflineBanner() {
  return (
    <div role="status">
      <QuietStub side={<IconWifiOff size={20} className="text-ink" />}>
        <p className="text-[15px] font-semibold leading-snug text-ink">You&apos;re offline</p>
        <p className="text-[14px] leading-snug text-ink-2">Receipts refresh when you&apos;re back.</p>
      </QuietStub>
    </div>
  )
}

function RowSkeleton() {
  return (
    <QuietStub side={<Skeleton className="h-8 w-10 rounded-md" />}>
      <span className="flex flex-col gap-2" aria-hidden="true">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </span>
    </QuietStub>
  )
}

/** Quiet state as a stub: dot glyph on the torn-off side (empty states keep the dot family), line, body, action. */
function Quiet({ glyph, title, body, action }: { glyph: DotIconName; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <QuietStub side={<DotIcon name={glyph} size={30} />} className="anim-rise">
      <p className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">{title}</p>
      <div className="mt-1 text-[15px] leading-[1.55] text-ink-2">{body}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </QuietStub>
  )
}

const VERDICT = { CHECKING: 'verifying', MATCH: 'match', ALTERED: 'altered', NOT_FOUND: 'not_found' } as const

/** Container: polls GET /api/citizen/receipts every 3 s while a profile exists. */
function ReceiptList({ pane, focus, selectedId }: { pane?: ReactNode; focus: 'list' | 'pane'; selectedId?: string }) {
  const online = useOnline()
  const now = useNow()
  const { toast } = useToast()
  const router = useRouter()

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
      name={q.data?.profile.displayName}
      autoWelcome
      onMove={(id) => router.push(`/citizen/receipt/${encodeURIComponent(id)}`, { scroll: false })}
    />
  )
  return pane === undefined ? list : <ReceiptsSplit focus={focus} list={list} pane={pane} paneKey={selectedId} />
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
  name,
  sheet: forcedSheet,
  autoWelcome = false,
  onMove,
}: {
  state: ReceiptListState
  receipts: ReceiptOpening[]
  code: string
  now: number
  online: boolean
  /** Polling is active: the pass shows "Live" with a pulsing dot (static under reduced motion). */
  watching: boolean
  /** eventIds that arrived in the last 10 s: slide-in and a blue dot. */
  freshIds: string[]
  /** Auto-verify result per eventId. 'altered' turns that row red (one flash) and raises the banner. */
  verdicts?: AutoVerdicts
  /** Receipts this phone saw before that the database no longer returns: torn red DELETED stubs. */
  ghosts?: GhostReceipt[]
  /** Sealed receipts found on chain for this profile that the company no longer shows and this phone has no copy of. */
  hiddenExtra?: number
  error?: string | null
  retrying?: boolean
  demoHint?: boolean
  /** Laptop master–detail: the receipt open in the pane (ink-filled stub). */
  selectedId?: string
  onCopy: () => void
  onRetry: () => void
  /** Synthetic citizen's name, for the one-time identity sheet. */
  name?: string
  /** Gallery: force a sheet open. */
  sheet?: 'welcome' | 'how'
  /** Show the identity sheet once per session code in this browser (localStorage). */
  autoWelcome?: boolean
  /** Laptop up/down: open this receipt in the pane. Without it the keys do nothing. */
  onMove?: (eventId: string) => void
}) {
  const [firstRun, dismissFirstRun] = useFirstRun(code, autoWelcome && !!name && (state === 'ready' || state === 'empty'))
  const [howOpen, setHowOpen] = useState(forcedSheet === 'how')
  const [welcomeForced, setWelcomeForced] = useState(forcedSheet === 'welcome')
  const welcomeOpen = (firstRun || welcomeForced) && !howOpen
  const closeWelcome = () => {
    setWelcomeForced(false)
    dismissFirstRun()
  }
  // Laptop-only filter by event type (riset-ui/36 graft from C). Phones never see the pills, so non-matching
  // rows are hidden with a container query only: a phone always shows every receipt.
  const [filter, setFilter] = useState<number | 'all'>('all')
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
  const tampered = altered.length + lost.length + hiddenExtra
  const pass = passStatus({ state, total: receipts.length, matched, checking, anchored, sealing, tampered, watching })
  const types = TYPE_FILTERS.map(([t, label]) => [t, label, receipts.filter((r) => r.eventType === t).length] as const).filter(([, , n]) => n > 0)
  const active = filter !== 'all' && types.some(([t]) => t === filter) ? filter : 'all'
  const shownOnLaptop = (r: ReceiptOpening) => active === 'all' || r.eventType === active

  // Laptop up/down (and j/k) move the selection through the visible receipts, in list order (Linear / Mail).
  const order = useRef<string[]>([])
  const selectedRef = useRef(selectedId)
  useEffect(() => {
    order.current =
      state === 'ready' && now
        ? BUCKETS.flatMap((b) => receipts.filter((r) => timeBucket(r.createdAt, now) === b && (active === 'all' || r.eventType === active)).map((r) => r.eventId))
        : []
    selectedRef.current = selectedId
  })
  useEffect(() => {
    if (!onMove) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      const down = e.key === 'ArrowDown' || e.key === 'j'
      const up = e.key === 'ArrowUp' || e.key === 'k'
      if (!down && !up) return
      const t = e.target as HTMLElement | null
      if (t && (t.closest('input,textarea,select,[contenteditable="true"],dialog[open]') || t.isContentEditable)) return
      if (!window.matchMedia('(min-width: 1024px)').matches) return
      const ids = order.current
      if (!ids.length) return
      const at = selectedRef.current ? ids.indexOf(selectedRef.current) : -1
      const next = at < 0 ? ids[down ? 0 : ids.length - 1] : ids[Math.min(ids.length - 1, Math.max(0, at + (down ? 1 : -1)))]
      if (!next || next === selectedRef.current) return
      e.preventDefault()
      onMove(next)
      document.querySelector(`[data-event-id="${CSS.escape(next)}"]`)?.scrollIntoView({ block: 'nearest' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onMove])

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">Receipts</h1>
        {/* Laptop: the pass lives in the sidebar, so the verdict is one line under the title. */}
        <p className="mt-2 hidden items-center gap-2 text-[14px] leading-snug text-ink-2 @5xl:flex">
          <PassGlyph verdict={pass.verdict} />
          <span className={`min-w-0 ${pass.verdict === 'tamper' ? 'font-medium text-bad' : ''}`}>
            {pass.title}
            {state === 'ready' && pass.verdict !== 'tamper' ? <span className="text-ink-3"> · {watching ? 'checked just now' : 'paused'}</span> : null}
          </span>
        </p>
      </header>

      {/* Phone: the Citizen Pass first, the answer to "is my data OK?", with the code on the tear-off. */}
      <div className="sl-rise @5xl:hidden">
        <CitizenPass code={code} verdict={pass.verdict} title={pass.title} subtitle={pass.subtitle} size="full" onCopy={code ? onCopy : undefined} />
      </div>

      <TamperBanner altered={altered.length} deleted={lost.length + hiddenExtra} checked={checked} href={altered[0] ? `/citizen/receipt/${altered[0]}?check=1` : null} />

      {!online ? <OfflineBanner /> : null}

      {/* polite announcement for receipts that just arrived */}
      <p aria-live="polite" className="sr-only">
        {fresh.map((r) => `New receipt: ${r.controllerName} ${r.eventType === 3 ? 'shared' : 'accessed'} your data.`).join(' ')}
      </p>
      {/* assertive announcement when a chain check proves a receipt altered */}
      <p aria-live="assertive" className="sr-only">
        {receipts
          .filter((r) => altered.includes(r.eventId))
          .map((r) => `Receipt from ${r.controllerName} was altered: it no longer matches the sealed record.`)
          .join(' ')}
      </p>

      {lost.length ? (
        <section aria-labelledby="bucket-deleted" className="flex flex-col gap-2.5">
          <h2 id="bucket-deleted" className="px-1 text-[15px] font-semibold text-ink">
            Missing from the database
          </h2>
          {lost.map((g) => (
            <GhostRow key={g.opening.eventId} ghost={g} now={now} />
          ))}
        </section>
      ) : null}

      {state === 'ready' && types.length > 1 ? (
        <div role="group" aria-label="Filter receipts by what the agency did" className="-mx-1 -my-1 hidden gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] @5xl:flex">
          <FilterPill label="All" count={receipts.length} on={active === 'all'} onClick={() => setFilter('all')} />
          {types.map(([t, label, n]) => (
            <FilterPill key={t} label={label} count={n} on={active === t} onClick={() => setFilter(t)} />
          ))}
        </div>
      ) : null}

      {state === 'loading' ? (
        <div className="flex flex-col gap-2.5" aria-label="Loading receipts">
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
          title="No agency has opened your data yet"
          body={
            <>
              Show your code to an agency. When they open your record, Saksi witnesses it and the receipt lands here.
              <span className="mt-2.5 block text-[14px] text-ink-3">{watching ? 'Saksi is watching for new receipts' : 'Paused'}</span>
            </>
          }
        />
      ) : (
        <div key={String(active)} className={`flex flex-col gap-6 ${active === 'all' ? '' : 'wt-fade'}`}>
          {BUCKETS.map((b) => {
            const items = receipts.filter((r) => (now ? timeBucket(r.createdAt, now) : 'EARLIER') === b)
            if (items.length === 0) return null
            const laptopCount = items.filter(shownOnLaptop).length
            return (
              <section key={b} aria-labelledby={`bucket-${b}`} className={laptopCount === 0 ? '@5xl:hidden' : ''}>
                <div className="flex items-baseline justify-between px-1 pb-2.5">
                  <h2 id={`bucket-${b}`} className="text-[15px] font-semibold text-ink">
                    {BUCKET_LABEL[b]}
                  </h2>
                  <span className="tnum text-[13px] text-ink-2">
                    <span className="@5xl:hidden">{receiptCount(items.length)}</span>
                    <span className="hidden @5xl:inline">{receiptCount(laptopCount)}</span>
                  </span>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {items.map((r) => (
                    <li key={r.eventId} className={shownOnLaptop(r) ? '' : '@5xl:hidden'}>
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
        <p className="flex items-center gap-2 px-1 text-[14px] text-ink-3">
          <IconEye size={14} /> A company will open your data in a few seconds…
        </p>
      ) : null}

      {/* Footer link: the quiet explainer of what Saksi does (sheet). */}
      <button
        type="button"
        onClick={() => setHowOpen(true)}
        className="-mt-1 flex min-h-11 w-fit items-center gap-2 px-1 text-[14px] font-medium text-ink-2 transition-colors duration-150 hover:text-ink"
      >
        <IconLock size={14} /> How Saksi witnesses
        <IconChevron size={14} className="text-ink-3" />
      </button>

      <HowSaksiWitnesses open={howOpen} onClose={() => setHowOpen(false)} />
      {name && code ? (
        <IdentitySheet
          open={welcomeOpen}
          name={name}
          code={code}
          onClose={closeWelcome}
          onShowHow={() => {
            closeWelcome()
            setHowOpen(true)
          }}
        />
      ) : null}

      <TabBar />
    </div>
  )
}

const BUCKET_LABEL = { NOW: 'Just now', TODAY: 'Today', EARLIER: 'Earlier' } as const
const TYPE_FILTERS: ReadonlyArray<readonly [number, string]> = [
  [0, 'Read'],
  [1, 'Updated'],
  [2, 'Exported'],
  [3, 'Shared'],
]
const receiptCount = (n: number) => `${n} ${n === 1 ? 'receipt' : 'receipts'}`

/** Laptop filter pill (riset-ui/36, from C): "Read 4". Ink when on. */
function FilterPill({ label, count, on, onClick }: { label: string; count: number; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-pill px-3 text-[13px] font-medium transition-colors duration-150 ${
        on ? 'bg-ink text-paper' : 'bg-card text-ink shadow-[0_0_0_1px_var(--color-line)] hover:shadow-[0_0_0_1px_var(--color-line-strong)]'
      }`}
    >
      {label}
      <span className={`tnum font-normal ${on ? 'text-paper/70' : 'text-ink-2'}`}>{count}</span>
    </button>
  )
}

/** Small verdict mark for the laptop status line. Red only for tampering. */
function PassGlyph({ verdict }: { verdict: PassVerdict }) {
  if (verdict === 'checking') return <IconSpinner size={16} className="shrink-0 text-ink-3" />
  const tone = verdict === 'ok' ? 'bg-ok-bg text-ok' : verdict === 'tamper' ? 'bg-bad-bg text-bad' : 'bg-paper-2 text-ink-3'
  return (
    <span aria-hidden="true" className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${tone}`}>
      {verdict === 'ok' ? <IconCheck size={10} strokeWidth={2.8} /> : verdict === 'tamper' ? <IconX size={10} strokeWidth={2.8} /> : <IconShield size={10} strokeWidth={2.4} />}
    </span>
  )
}
