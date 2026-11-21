'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar, IconChevron, WaitingForChain } from '@/components/citizen/ReceiptRows'
import { ReceiptFacts, ReceiptStatusPill } from '@/components/citizen-workspace/ReceiptFacts'
import { AiPanel } from '@/components/ui/AiPanel'
import { Act } from '@/components/citizen/Act'
import { Cta } from '@/components/landing/Cta'
import { NotFoundScreen } from '@/components/system/NotFoundScreen'
import { IconDownload, IconQuestion, IconRefresh, IconShare, IconSpark, IconX } from '@/components/ui/icons'
import { DotIcon } from '@/components/ui/DotIcon'
import { Limits } from '@/components/ui/Limits'
import { ReceiptDetailSkeleton } from '@/components/ui/Skeleton'
import { TabBar } from '@/components/ui/TabBar'
import { useToast } from '@/components/ui/Toast'
import { VerifyStage, type VerifyPhase } from '@/components/ui/VerifyResult'
import { runCheck, useAutoVerify, useReceiptCheck } from '@/lib/client/receipt-checks'
import { downloadReceiptFile, explain, findReceipt, shareProof, toCitizenError, type ExplainResponse } from '@/lib/data'
import { rememberedReceipt } from '@/lib/client/seen-receipts'
import { formatWIB, timeAgo } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { contentKey, receiptHeadline, verdictNote, type ReceiptCheck } from '@/lib/receipt-state'
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
    return (
      <ReceiptMissingView
        error={q.isError && !noSession ? toCitizenError(q.error).message : null}
        noSession={noSession}
        retrying={q.isFetching}
        onRetry={onRetry}
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

/** Receipt not in this profile (error = null), no profile yet (noSession), or the load failed (error message + retry). */
export function ReceiptMissingView({
  error,
  noSession,
  retrying,
  onRetry,
}: {
  error: string | null
  noSession?: boolean
  retrying?: boolean
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {error || noSession ? <BackLink /> : null}
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
          title="No demo profile in this browser"
          body="Receipts belong to a profile. Create a synthetic profile first, then open your receipts from the list."
          action={
            <Cta href="/citizen">Create profile</Cta>
          }
        />
      ) : (
        // Same screen as the route's not-found.tsx (riset-ui/24 §3); rendered here because this is a client container.
        <NotFoundScreen kind="receipt" chrome="embedded" stack />
      )}
      <TabBar />
    </div>
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

const NOTE_TONE: Record<string, string> = {
  MATCH: 'text-ok',
  ALTERED: 'text-bad',
  NOT_FOUND: 'text-unknown',
  CHECKING: 'text-blue',
}

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
  demoSwitcher?: ReactNode
}) {
  // One verdict drives the headline, the badge and the ledger rows, so they never disagree.
  const check = checkProp ?? checkFromVerify(verify)
  const head = receiptHeadline(opening, check)
  const note = verdictNote(head.kind)
  const verified = check.phase === 'done' || (verify.phase === 'done' && !!verify.result)
  const altered = head.kind === 'ALTERED'
  const sealing = opening.status === 'pending' || opening.status === 'submitted'
  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      {/* Hero (riset-ui/35 detail §2–3): who + what + when, then the one status. */}
      <div className="flex flex-col items-start gap-4">
        <Avatar name={opening.controllerName} size={56} tone={altered ? 'bad' : 'neutral'} />
        <div>
          <h1 className="text-balance text-[24px] font-semibold leading-[1.2] tracking-[-0.02em] text-ink">
            {head.who} <span className={head.source === 'chain' ? 'text-bad' : undefined}>{head.act}.</span>
          </h1>
          <p className="mt-1.5 text-[14px] leading-snug text-ink-2">
            {formatWIB(opening.createdAt)} · {opening.purposeText}
            {now ? <span className="text-ink-3"> · {timeAgo(opening.createdAt, now)}</span> : null}
          </p>
        </div>
        <ReceiptStatusPill kind={head.kind} />
        {head.claimed ? (
          <p className="-mt-1 text-[14px] leading-snug text-bad">
            The chain sealed this. The database now says: <span className="line-through decoration-[1.5px]">{head.claimed}</span>
          </p>
        ) : null}
      </div>

      <section aria-label="Receipt details" className="flex flex-col gap-2">
        <h2 className="px-1 text-[15px] font-semibold text-ink">Details</h2>
        <ReceiptFacts opening={opening} check={check} />
      </section>

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
            {!verified ? <p className="text-center text-[13px] text-ink-3">Check on chain first. AI explains the verdict.</p> : null}
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

      {demoSwitcher}

      <TabBar />
    </div>
  )
}
