'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RiseHeading } from '@/components/citizen/motion'
import { WaitingForChain } from '@/components/citizen/ReceiptRows'
import { AiPanel } from '@/components/ui/AiPanel'
import { Badge, receiptBadgeKind } from '@/components/ui/Badge'
import { Act } from '@/components/citizen/Act'
import { Cta } from '@/components/landing/Cta'
import { NotFoundScreen } from '@/components/system/NotFoundScreen'
import { IconArrow, IconDownload, IconQuestion, IconRefresh, IconShare, IconSpark, IconX } from '@/components/ui/icons'
import { DotIcon } from '@/components/ui/DotIcon'
import { LedgerReceipt } from '@/components/ui/LedgerReceipt'
import { Limits } from '@/components/ui/Limits'
import { ReceiptDetailSkeleton } from '@/components/ui/Skeleton'
import { TabBar } from '@/components/ui/TabBar'
import { useToast } from '@/components/ui/Toast'
import { VerifyStage, type VerifyPhase } from '@/components/ui/VerifyResult'
import { downloadReceiptFile, explain, findReceipt, shareProof, toCitizenError, verifyTimed, type ExplainResponse } from '@/lib/data'
import { actSentence, timeAgo } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import type { ReceiptOpening, VerifyResult } from '@/lib/shared/types'

/** Container: loads the receipt from this profile's GET /api/citizen/receipts. */
export function ReceiptDetail() {
  const { eventId } = useParams<{ eventId: string }>()

  const q = useQuery({ queryKey: ['receipt', eventId], queryFn: () => findReceipt(eventId) })

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
  return <Detail opening={q.data} />
}

function BackLink() {
  return (
    <Link href="/citizen" className="label -ml-2 flex min-h-11 w-fit items-center gap-2 px-2 text-ink-2 hover:text-blue">
      <IconArrow size={14} className="rotate-180" /> Receipts
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

/** Container: owns verify + AI state. Every button maps to one handler below. */
function Detail({ opening }: { opening: ReceiptOpening }) {
  const now = useNow()
  const { toast } = useToast()
  const sheet = useRef<HTMLDialogElement>(null)
  const [phase, setPhase] = useState<VerifyPhase>('idle')
  const [startedAt, setStartedAt] = useState(0)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const ai = useMutation({
    mutationFn: () => explain(opening),
  })
  // "See what changed" (banner / red row) links here with ?check=1: re-run the phone's check on open.
  const autoCheck = useSearchParams()?.get('check') === '1'

  const onVerify = async () => {
    setPhase('running')
    setResult(null)
    setStartedAt(Date.now())
    try {
      const r = await verifyTimed(opening)
      setResult(r)
      setPhase('done')
      if (r.status === 'MISMATCH' && 'vibrate' in navigator) navigator.vibrate?.([40, 60, 40])
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : 'Verification failed. Check your connection.')
      setPhase('error')
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
      await downloadReceiptFile(opening)
      toast('Saved. This file still matches the chain.')
    } catch {
      toast('Download failed', 'info')
    }
  }

  return (
    <>
      <ReceiptDetailView
        opening={opening}
        now={now}
        verify={{ phase, startedAt, result, error: verifyError }}
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
        className="anim-sheet m-0 mt-auto max-h-[85dvh] w-full max-w-full rounded-t-xl bg-paper p-0 backdrop:bg-ink/50 sm:mx-auto sm:max-w-[430px]"
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

/** C3–C4: ledger receipt + verify + AI. Purely presentational. */
export function ReceiptDetailView({
  opening,
  now,
  verify,
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
  const who = opening.controllerName.replace(' (fictional)', '')
  const verified = verify.phase === 'done' && !!verify.result
  const altered = verified && verify.result?.status === 'MISMATCH'
  const sealing = opening.status === 'pending' || opening.status === 'submitted'
  return (
    <div className="flex flex-col gap-5">
      <BackLink />

      <RiseHeading as="h1" lead={who} tail={`${actSentence(opening.eventType)}.`} className="text-[34px] leading-[1.04] text-ink" />

      <LedgerReceipt
        opening={opening}
        header={
          <div className="flex items-center justify-between gap-2">
            {altered ? <Badge kind="ALTERED" /> : <Badge kind={receiptBadgeKind(opening.status)} />}
            <span className="label text-[11px] text-ink-2">{now ? timeAgo(opening.createdAt, now) : ''}</span>
          </div>
        }
      />

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
            {!verified ? <p className="label text-center text-[11px] text-ink-2">Verify first — AI explains the verdict</p> : null}
          </>
        ) : null}

        {ai.state !== 'idle' ? (
          <div aria-live="polite">
            <AiPanel state={ai.state} text={ai.data?.text} meta={ai.data?.meta} error={ai.error ?? undefined} onRetry={onExplain} />
          </div>
        ) : null}

        <button
          type="button"
          onClick={onShowLimits}
          className="flex min-h-11 items-center justify-center gap-2 text-[15px] font-medium text-ink-2 transition-colors duration-150 hover:text-ink"
        >
          <IconQuestion size={16} /> What does Saksi prove?
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <Act variant="light" size="md" full icon={<IconDownload size={15} />} onClick={onDownload}>
            Download
          </Act>
          <Act variant="light" size="md" full icon={<IconShare size={15} />} onClick={onShare} disabled={!opening.txHash}>
            Share proof
          </Act>
        </div>
      </div>

      {demoSwitcher}

      <TabBar />
    </div>
  )
}
