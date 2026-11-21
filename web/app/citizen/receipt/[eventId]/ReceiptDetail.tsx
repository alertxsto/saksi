'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconChevron, initials } from '@/components/citizen/ReceiptRows'
import { ChainReadout, VerdictStamp, type StampKind } from '@/components/citizen/VerdictStamp'
import { ReceiptFacts, ReceiptStatusPill } from '@/components/citizen-workspace/ReceiptFacts'
import { AiPanel } from '@/components/ui/AiPanel'
import { Act } from '@/components/citizen/Act'
import { Cta } from '@/components/landing/Cta'
import { NotFoundScreen } from '@/components/system/NotFoundScreen'
import { IconClock, IconDownload, IconQuestion, IconRefresh, IconShare, IconSpark, IconX } from '@/components/ui/icons'
import { DotIcon } from '@/components/ui/DotIcon'
import { Limits } from '@/components/ui/Limits'
import { ReceiptDetailSkeleton } from '@/components/ui/Skeleton'
import { TabBar } from '@/components/ui/TabBar'
import { useToast } from '@/components/ui/Toast'
import { VerifyStage, type VerifyPhase } from '@/components/ui/VerifyResult'
import { runCheck, useAutoVerify, useReceiptCheck } from '@/lib/client/receipt-checks'
import { downloadReceiptFile, explain, findReceipt, shareProof, toCitizenError, type ExplainResponse } from '@/lib/data'
import { rememberedChain, rememberedReceipt } from '@/lib/client/seen-receipts'
import { ReportAccess } from '@/components/citizen/ReportAccess'
import { formatWIB, timeAgo } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { contentKey, receiptHeadline, type ReceiptCheck } from '@/lib/receipt-state'
import '@/app/citizen/stub-ticket.css'
import type { ReceiptOpening, VerifyResult } from '@/lib/shared/types'

/**
 * Container: loads the receipt from this profile's GET /api/citizen/receipts, polled like the list so an
 * edit to the database row shows up here too (and is re-checked against the chain).
 */
export function ReceiptDetail() {
  const { eventId } = useParams<{ eventId: string }>()

  const q = useQuery({
    queryKey: ['receipt', eventId],
    queryFn: () => findReceipt(eventId),
    refetchInterval: (query) => (query.state.status === 'error' ? false : 3000),
    refetchIntervalInBackground: false,
  })

  if (q.isPending) return <ReceiptDetailSkeleton />
  if (q.isError || !q.data) {
    const onRetry = () => void q.refetch()
    const noSession = q.isError && toCitizenError(q.error).code === 'NO_SESSION'
    // Gone from the company's store but remembered by this phone: it can still be reported from its chain position.
    const chain = q.isError ? null : rememberedChain(eventId)
    return (
      <ReceiptMissingView
        error={q.isError && !noSession ? toCitizenError(q.error).message : null}
        noSession={noSession}
        retrying={q.isFetching}
        onRetry={onRetry}
        report={chain ? <ReportAccess eventId={eventId} verdict="altered" chain={chain} /> : null}
      />
    )
  }
  return <Detail opening={q.data} reload={async () => (await q.refetch()).data ?? null} />
}

function BackLink() {
  return (
    // Laptop: the pane has its own close button and the list stays beside it.
    <Link href="/citizen" className="-ml-2 flex min-h-11 w-fit items-center gap-1 px-2 text-[15px] font-medium text-ink-2 hover:text-ink @5xl:hidden">
      <IconChevron size={18} className="rotate-180" /> Receipts
    </Link>
  )
}

function Quiet({ glyph, title, body, action }: { glyph: 'clock' | 'eye' | 'cross'; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="anim-rise flex flex-col items-start gap-3 rounded-xl border border-line bg-card p-5">
      <DotIcon name={glyph} size={40} className="text-ink-3" />
      <div>
        <p className="text-[19px] font-medium leading-snug tracking-[-0.015em] text-ink">{title}</p>
        <p className="mt-1 text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2">{body}</p>
      </div>
      {action}
    </div>
  )
}

/**
 * Receipt not in this profile (error = null), no profile yet (noSession), or the load failed (error message + retry).
 * `report` is set for a receipt the company deleted that this phone still remembers with its chain position.
 */
export function ReceiptMissingView({
  error,
  noSession,
  retrying,
  onRetry,
  report,
}: {
  error: string | null
  noSession?: boolean
  retrying?: boolean
  onRetry: () => void
  report?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      {error || noSession || report ? <BackLink /> : null}
      {error ? (
        <Quiet
          glyph="clock"
          title="Couldn't load this receipt"
          body={error}
          action={
            <Act variant="light" size="md" icon={<IconRefresh size={15} />} onClick={onRetry} loading={retrying}>
              Try again
            </Act>
          }
        />
      ) : noSession ? (
        <Quiet
          glyph="eye"
          title="No profile in this browser"
          body="Receipts belong to a profile. Create a synthetic profile first, then open your receipts from the list."
          action={
            <Cta href="/citizen">Create profile</Cta>
          }
        />
      ) : report ? (
        <>
          <DeletedTicket />
          {report}
        </>
      ) : (
        // Same screen as the route's not-found.tsx (riset-ui/24 §3); rendered here because this is a client container.
        <NotFoundScreen kind="receipt" chrome="embedded" stack />
      )}
      <TabBar />
    </div>
  )
}

/**
 * A receipt the company deleted: the ticket outline is still here (dashed, it is an absence), the body is gone.
 * Red only for the tamper fact itself.
 */
function DeletedTicket() {
  return (
    <section aria-labelledby="deleted-title" className="st-rise flex flex-col gap-4 rounded-xl border-2 border-dashed border-line-strong bg-paper-2/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <DotIcon name="cross" size={36} className="text-bad" />
        <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-pill bg-bad-bg px-2.5 text-[13px] font-medium text-bad">
          <IconX size={12} strokeWidth={2.6} aria-hidden="true" /> Deleted
        </span>
      </div>
      <div>
        <h1 id="deleted-title" className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
          Deleted by the company
        </h1>
        <p className="mt-2 text-[15px] leading-[1.55] text-ink-2">
          This record is gone from the company’s side but <span className="font-medium text-ink">still sealed on the chain</span>, so you can
          still report it.
        </p>
      </div>
    </section>
  )
}

/** Amber: the company logged the access and its fingerprint is being sealed. Never red. */
function WaitingForChain() {
  return (
    <section aria-label="Waiting for the chain" className="flex gap-3 rounded-lg border border-pending/30 bg-pending-bg p-4">
      <span aria-hidden="true" className="cz-blink-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-pending/12 text-pending">
        <IconClock size={19} />
      </span>
      <div className="min-w-0">
        <p className="text-[16px] font-medium leading-snug text-pending">Sealing…</p>
        <p className="mt-0.5 text-[14px] leading-relaxed text-ink-2">
          The company logged this access. Its fingerprint is going on chain now; your phone can check it in a moment.
        </p>
      </div>
    </section>
  )
}

type ManualRun = { key: string; phase: VerifyPhase; startedAt: number; result: VerifyResult | null; error: string | null }

/** Container: owns verify + AI state. Every button maps to one handler below. */
function Detail({ opening, reload }: { opening: ReceiptOpening; reload: () => Promise<ReceiptOpening | null> }) {
  const now = useNow()
  const { toast } = useToast()
  const sheet = useRef<HTMLDialogElement>(null)
  const [run, setRun] = useState<ManualRun | null>(null)
  // Background check from this browser (shared with the list): the header shows its verdict even before a tap.
  useAutoVerify([opening])
  const check = useReceiptCheck(opening)
  // A manual result belongs to the content it compared; if the row changed since, it no longer applies.
  const key = contentKey(opening)
  const manual = run && (run.key === key || run.phase === 'running') ? run : null

  const ai = useMutation({
    mutationFn: () => explain(opening),
  })
  // "See what changed" (banner / red row) links here with ?check=1: re-run the phone's check on open.
  const autoCheck = useSearchParams()?.get('check') === '1'

  const onVerify = async () => {
    const startedAt = Date.now()
    setRun({ key, phase: 'running', startedAt, result: null, error: null })
    try {
      // Re-read the database row first so the check compares what the company says right now.
      const fresh = (await reload()) ?? opening
      const result = await runCheck(fresh)
      setRun({ key: contentKey(fresh), phase: 'done', startedAt, result, error: null })
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Verification failed. Check your connection.'
      setRun({ key, phase: 'error', startedAt, result: null, error })
    }
  }

  const onExplain = () => ai.mutate()

  const autoRef = useRef(false)
  const verifyRef = useRef(onVerify)
  useEffect(() => {
    verifyRef.current = onVerify
  })
  useEffect(() => {
    if (!autoCheck || autoRef.current) return
    autoRef.current = true
    void verifyRef.current()
  }, [autoCheck])

  const onShare = async () => {
    try {
      if ((await shareProof(opening)) === 'copied') toast('Proof link copied')
    } catch {
      // user cancelled the share sheet
    }
  }

  const onDownload = async () => {
    try {
      await downloadReceiptFile(opening)
      toast('Receipt downloaded')
    } catch {
      toast('Download failed', 'info')
    }
  }

  /** ALTERED: save the receipt file the chain still matches, so the citizen holds the evidence. */
  const onKeepEvidence = async () => {
    try {
      // The database row was edited, so save the copy this phone saw match the chain when there is one.
      const sealed = rememberedReceipt(opening.eventId)
      await downloadReceiptFile(sealed ?? opening)
      toast(sealed ? 'Saved. This file still matches the chain.' : 'Saved. The chain still holds the sealed fingerprint.')
    } catch {
      toast('Download failed', 'info')
    }
  }

  return (
    <>
      <ReceiptDetailView
        opening={opening}
        now={now}
        verify={{
          phase: manual?.phase ?? 'idle',
          startedAt: manual?.startedAt,
          result: manual?.result,
          error: manual?.error,
        }}
        check={check}
        ai={{
          state: ai.isPending ? 'loading' : ai.isError ? 'error' : ai.isSuccess ? 'done' : 'idle',
          data: ai.data,
          error: ai.error ? toCitizenError(ai.error).message : null,
        }}
        onVerify={() => void onVerify()}
        onExplain={onExplain}
        onShowLimits={() => sheet.current?.showModal()}
        onDownload={() => void onDownload()}
        onShare={() => void onShare()}
        onKeepEvidence={() => void onKeepEvidence()}
        renderReport={(altered) => <ReportAccess eventId={opening.eventId} verdict={altered ? 'altered' : undefined} />}
      />

      <dialog
        ref={sheet}
        aria-labelledby="limits-title"
        className="anim-sheet m-0 mt-auto max-h-[85dvh] w-full max-w-full rounded-t-xl bg-paper p-0 backdrop:bg-ink/50 sm:mx-auto sm:max-w-[430px] lg:mb-auto lg:max-w-[480px] lg:rounded-xl"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close()
        }}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <h2 id="limits-title" className="label text-ink">
            What Saksi proves
          </h2>
          <button
            type="button"
            onClick={() => sheet.current?.close()}
            className="flex h-11 w-11 items-center justify-center text-ink-2 hover:text-ink"
            aria-label="Close"
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="p-4">
          <Limits compact />
        </div>
      </dialog>
    </>
  )
}

export type DetailVerifyState = {
  phase: VerifyPhase
  startedAt?: number
  /** Freezes the running timer (dev gallery). */
  elapsedMs?: number
  result?: VerifyResult | null
  error?: string | null
}

export type DetailAiState = {
  state: 'idle' | 'loading' | 'done' | 'error'
  data?: ExplainResponse
  error?: string | null
}

/** The header's chain state when no shared check is passed (dev gallery): derived from the verify block. */
function checkFromVerify(verify: DetailVerifyState): ReceiptCheck {
  if (verify.phase === 'running') return { phase: 'running' }
  if (verify.phase === 'done' && verify.result) return { phase: 'done', result: verify.result, at: 0 }
  if (verify.phase === 'error') return { phase: 'error', error: verify.error ?? '', at: 0 }
  return { phase: 'idle' }
}

/** Short verb for the ticket's big type, and what follows it. */
const VERB = ['Read', 'Updated', 'Exported', 'Shared'] as const
const TAIL = ['your data', 'your data', 'your data', 'your data with a third party'] as const

const WIB_TIME = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' })

/** C3–C4: ledger receipt + verify + AI. Purely presentational. */
/** Quiet text action under the main buttons (Save receipt, Share proof…). */
function TextAction({ icon, children, onClick, disabled }: { icon: ReactNode; children: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-11 items-center gap-1.5 rounded-md px-3 text-[14px] font-medium text-ink-2 transition-colors duration-150 hover:bg-ink/[.05] hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
    >
      {icon}
      {children}
    </button>
  )
}

export function ReceiptDetailView({
  opening,
  now,
  verify,
  check: checkProp,
  ai,
  onVerify,
  onExplain,
  onShowLimits,
  onDownload,
  onShare,
  onKeepEvidence,
  renderReport,
  demoSwitcher,
}: {
  opening: ReceiptOpening
  now: number
  verify: DetailVerifyState
  /** This browser's latest chain check for the receipt (background or manual). Defaults to the verify block. */
  check?: ReceiptCheck
  ai: DetailAiState
  onVerify: () => void
  onExplain: () => void
  onShowLimits: () => void
  onDownload: () => void
  onShare: () => void
  /** ALTERED verdict: "Keep as evidence" (saves the receipt file). */
  onKeepEvidence: () => void
  /** "Report to the regulator" block; the container passes ReportAccess, the gallery can leave it out. */
  renderReport?: (altered: boolean) => ReactNode
  demoSwitcher?: ReactNode
}) {
  // One verdict drives the headline, the stamp, the badge and the ledger rows, so they never disagree.
  const check = checkProp ?? checkFromVerify(verify)
  const head = receiptHeadline(opening, check)
  const verified = check.phase === 'done' || (verify.phase === 'done' && !!verify.result)
  const altered = head.kind === 'ALTERED'
  const sealing = opening.status === 'pending' || opening.status === 'submitted'
  const result = check.phase === 'done' && check.result.status !== 'NOT_FOUND' ? check.result : null
  const stamp: StampKind | null = head.kind === 'MATCH' ? 'ok' : altered ? 'bad' : head.kind === 'CHECKING' || verify.phase === 'running' ? 'checking' : null
  return (
    <div className="flex flex-col gap-5">
      <BackLink />

      {/* The receipt as one ticket (riset-ui/36 A): who, the verb as big type, the status; tear line; the facts. */}
      {/* Clip sideways only: the stamp lands from 1.9x and must never make the page scroll horizontally. */}
      <div className="-mx-4 overflow-x-clip px-4">
        <div className={`relative ${altered ? 'st-shadow-bad' : 'st-shadow'}`}>
          <article aria-labelledby="receipt-title">
          <div className="st-half-top relative rounded-t-xl bg-card px-5 pb-6 pt-5">
            <div className={`flex flex-col gap-4 ${stamp ? 'pr-[92px]' : ''}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${altered ? 'bg-bad-bg text-bad' : 'bg-paper-2 text-ink'}`}
                >
                  {initials(opening.controllerName)}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 break-words text-[15px] font-semibold leading-tight text-ink">{head.who}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-2">
                    Opened your data · {WIB_TIME(opening.createdAt)}
                  </span>
                </span>
              </div>
              <h1 id="receipt-title" className="min-w-0">
                <span className="sr-only">{head.who} </span>
                <span
                  className={`block text-[clamp(40px,12vw,56px)] font-semibold leading-[0.92] tracking-[-0.045em] @5xl:text-[60px] ${head.source === 'chain' ? 'text-bad' : 'text-ink'}`}
                >
                  {VERB[head.eventType] ?? 'Used'}
                </span>
                <span className="mt-1.5 block text-balance text-[19px] font-normal leading-tight tracking-[-0.01em] text-ink-2">
                  {TAIL[head.eventType] ?? 'your data'}.
                </span>
              </h1>
            </div>
            {stamp ? (
              <div className="absolute right-3 top-3">
                <VerdictStamp kind={stamp} seconds={result ? result.elapsedMs / 1000 : undefined} size={108} />
              </div>
            ) : null}
            <p className="mt-3 text-[14px] leading-snug text-ink-2">
              {formatWIB(opening.createdAt)} · {opening.purposeText}
              {now ? <span> · {timeAgo(opening.createdAt, now)}</span> : null}
            </p>
            <div className="mt-4">
              <ReceiptStatusPill kind={head.kind} />
            </div>
            {head.claimed ? (
              <p className="mt-3 text-[14px] leading-snug text-bad">
                The chain sealed this. The database now says: <span className="line-through decoration-[1.5px]">{head.claimed}</span>
              </p>
            ) : null}
            <span aria-hidden="true" className="st-perf absolute bottom-0 left-5 right-5 text-line-strong" />
          </div>
          <section aria-label="Receipt details" className="st-half-bottom rounded-b-xl bg-card py-1.5">
            <ReceiptFacts opening={opening} check={check} inset />
          </section>
          </article>
        </div>
      </div>

      {result ? (
        <div aria-live="polite">
          <ChainReadout result={result} />
        </div>
      ) : null}

      {sealing && verify.phase === 'idle' ? <WaitingForChain /> : null}

      <VerifyStage
        phase={verify.phase}
        opening={opening}
        startedAt={verify.startedAt}
        elapsedMs={verify.elapsedMs}
        result={verify.result}
        error={verify.error}
        onVerify={onVerify}
        onKeepEvidence={onKeepEvidence}
        onAskAi={onExplain}
        variant="ticket"
        verifyLabel={check.phase === 'done' ? 'Check on chain again' : 'Verify on chain'}
      />

      <div className="flex flex-col gap-2.5">
        {!altered ? (
          <>
            <Act
              variant="light"
              full
              icon={<IconSpark size={16} className="text-ai" />}
              onClick={onExplain}
              disabled={!verified || ai.state === 'loading'}
              loading={ai.state === 'loading'}
            >
              Explain with AI
            </Act>
            {!verified ? <p className="text-center text-[13px] text-ink-2">Check on chain first. AI explains the verdict.</p> : null}
          </>
        ) : null}

        {ai.state !== 'idle' ? (
          <div aria-live="polite">
            <AiPanel state={ai.state} text={ai.data?.text} meta={ai.data?.meta} error={ai.error ?? undefined} onRetry={onExplain} />
          </div>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
          <TextAction icon={<IconDownload size={15} />} onClick={onDownload}>
            Save receipt
          </TextAction>
          <TextAction icon={<IconShare size={15} />} onClick={onShare} disabled={!opening.txHash}>
            Share proof
          </TextAction>
          <TextAction icon={<IconQuestion size={15} />} onClick={onShowLimits}>
            What Saksi proves
          </TextAction>
        </div>
      </div>

      {renderReport ? renderReport(altered) : null}

      {demoSwitcher}

      <TabBar />
    </div>
  )
}
