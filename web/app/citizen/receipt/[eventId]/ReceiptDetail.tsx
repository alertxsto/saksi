'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useRef, useState, type ReactNode } from 'react'
import { AiPanel } from '@/components/ui/AiPanel'
import { Badge, receiptBadgeKind } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconAlert, IconArrow, IconDownload, IconQuestion, IconReceipt, IconRefresh, IconShare, IconSpark, IconX } from '@/components/ui/icons'
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
      <BackLink />
      {error ? (
        <EmptyState
          tone="neutral"
          icon={<IconAlert size={20} />}
          title="Couldn't load this receipt"
          body={error}
          action={
            <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry} loading={retrying}>
              Try again
            </Button>
          }
        />
      ) : noSession ? (
        <EmptyState
          icon={<IconReceipt size={20} />}
          title="No demo profile in this browser"
          body="Receipts belong to a profile. Create a synthetic profile first, then open your receipts from the list."
          action={
            <ButtonLink href="/citizen" variant="dark" arrow size="sm">
              Create profile
            </ButtonLink>
          }
        />
      ) : (
        <EmptyState
          icon={<IconReceipt size={20} />}
          title="Receipt not found"
          body="This receipt is not in your profile. It may belong to a deleted demo profile."
        />
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
      toast('Download failed', 'bad')
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
  demoSwitcher?: ReactNode
}) {
  const who = opening.controllerName.replace(' (fictional)', '')
  const verified = verify.phase === 'done' && !!verify.result
  return (
    <div className="flex flex-col gap-5">
      <BackLink />

      <h1 className="display text-[30px] leading-[1.08] text-ink">
        {who} <span className="text-ink-2">{actSentence(opening.eventType)}.</span>
      </h1>

      <LedgerReceipt
        opening={opening}
        header={
          <div className="flex items-center justify-between gap-2">
            <Badge kind={receiptBadgeKind(opening.status)} />
            <span className="label text-[11px] text-ink-2">{now ? timeAgo(opening.createdAt, now) : ''}</span>
          </div>
        }
      />

      <VerifyStage
        phase={verify.phase}
        opening={opening}
        startedAt={verify.startedAt}
        elapsedMs={verify.elapsedMs}
        result={verify.result}
        error={verify.error}
        onVerify={onVerify}
      />

      <div className="flex flex-col gap-2.5">
        <Button
          variant="light"
          full
          icon={<IconSpark size={16} className="text-ai" />}
          onClick={onExplain}
          disabled={!verified || ai.state === 'loading'}
          loading={ai.state === 'loading'}
        >
          Explain with AI
        </Button>
        {!verified ? <p className="label text-center text-[11px] text-ink-2">Verify first — AI explains the verdict</p> : null}

        {ai.state !== 'idle' ? (
          <div aria-live="polite">
            <AiPanel
              state={ai.state}
              text={ai.data?.text}
              meta={ai.data?.meta}
              error={ai.error ?? undefined}
              onRetry={onExplain}
            />
          </div>
        ) : null}

        <Button variant="ghost" full icon={<IconQuestion size={16} />} onClick={onShowLimits}>
          What does Saksi prove?
        </Button>

        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="light" size="sm" icon={<IconDownload size={15} />} onClick={onDownload}>
            Download
          </Button>
          <Button variant="light" size="sm" icon={<IconShare size={15} />} onClick={onShare} disabled={!opening.txHash}>
            Share proof
          </Button>
        </div>
      </div>

      {demoSwitcher}

      <TabBar />
    </div>
  )
}
