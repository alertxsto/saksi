'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useEffect, useRef, useState, type ReactNode } from 'react'
import { Act } from '@/components/citizen/Act'
import { CitizenPass, type PassVerdict } from '@/components/citizen/CitizenPass'
import { tamperTitle } from '@/components/citizen/passStatus'
import { accessTotals, aggregateAccess, downloadReceiptsJson } from '@/components/citizen-workspace/access'
import { AccessList, AccessTotalsStrip, DataActions, ProfileGroup, RightsList } from '@/components/citizen-workspace/ProfileSections'
import { Cta } from '@/components/landing/Cta'
import { DotIcon } from '@/components/ui/DotIcon'
import { IconAlert, IconCopy, IconDownload, IconRefresh, IconTrash } from '@/components/ui/icons'
import { ProfileSkeleton } from '@/components/ui/Skeleton'
import { TabBar } from '@/components/ui/TabBar'
import { useToast } from '@/components/ui/Toast'
import { checkOf, useAutoVerify, useReceiptChecks } from '@/lib/client/receipt-checks'
import { forgetSeenReceipts, useTamperCounts } from '@/lib/client/seen-receipts'
import { copyText, deleteProfile, toCitizenError, type AutoVerdicts, type CitizenProfile } from '@/lib/data'
import { useNow } from '@/lib/hooks'
import { verdictKind } from '@/lib/receipt-state'
import type { ReceiptOpening } from '@/lib/shared/types'
import { receiptsQuery } from '../CitizenHome'

const VERDICT = { CHECKING: 'verifying', MATCH: 'match', ALTERED: 'altered', NOT_FOUND: 'not_found' } as const
const NO_RECEIPTS: ReceiptOpening[] = []

/**
 * Container: the profile and its receipts from the shared receipts query (GET /api/citizen/receipts, same
 * cache as the list), this browser's chain checks for the per-company verdicts, and delete
 * (DELETE /api/citizen/session).
 */
export function ProfileView() {
  const { toast } = useToast()
  const router = useRouter()
  const qc = useQueryClient()
  const now = useNow()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const q = useQuery(receiptsQuery)
  const noSession = q.isError && toCitizenError(q.error).code === 'NO_SESSION'
  const receipts = q.data?.receipts ?? NO_RECEIPTS
  const pseudonyms = q.data?.pseudonyms
  // Same background chain checks as the list, so "verified by your phone" is real even on a direct visit.
  useAutoVerify(receipts, useMemo(() => pseudonyms?.map((p) => p.pseudonym) ?? [], [pseudonyms]))
  const store = useReceiptChecks()
  const verdicts: AutoVerdicts = {}
  for (const r of receipts) {
    const kind = verdictKind(checkOf(store.checks, r))
    if (kind && (kind !== 'NOT_FOUND' || r.status === 'anchored')) verdicts[r.eventId] = VERDICT[kind]
  }
  // Deleted receipts (ghosts plus hidden), counted the same way as the list and the sidebar.
  const { deleted } = useTamperCounts(q.data?.profile.code ?? '', receipts, verdicts, q.isSuccess, store.hidden)
  const del = useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => {
      forgetSeenReceipts()
      setConfirmOpen(false)
      qc.removeQueries({ queryKey: ['receipts'] })
      qc.removeQueries({ queryKey: ['profile'] })
      toast('Profile deleted')
      router.push('/citizen')
    },
  })

  const code = q.data?.profile.code ?? ''
  const onCopy = async () => {
    try {
      await copyText(code)
      toast('Copied')
    } catch {
      toast('Copy failed', 'info')
    }
  }
  const onDeleteDemo = () => del.mutate()
  const onRetry = () => void q.refetch()
  const onDownloadAll = () => {
    try {
      downloadReceiptsJson(code, receipts)
      toast('Receipts downloaded')
    } catch {
      toast('Download failed', 'info')
    }
  }

  return (
    <ProfileScreenView
      state={q.isPending ? 'loading' : noSession ? 'none' : q.data ? 'ready' : q.isError ? 'error' : 'none'}
      profile={q.data?.profile ?? null}
      receipts={receipts}
      verdicts={verdicts}
      deleted={deleted}
      now={now}
      error={q.isError && !noSession && !q.data ? toCitizenError(q.error).message : null}
      confirm={!confirmOpen ? 'closed' : del.isPending ? 'deleting' : del.isError ? 'error' : 'open'}
      deleteError={del.isError ? toCitizenError(del.error).message : null}
      onCopy={() => void onCopy()}
      onAskDelete={() => {
        del.reset()
        setConfirmOpen(true)
      }}
      onCancelDelete={() => setConfirmOpen(false)}
      onDeleteDemo={onDeleteDemo}
      onDownloadAll={onDownloadAll}
      onRetry={onRetry}
    />
  )
}

export type ProfileState = 'loading' | 'none' | 'error' | 'ready'
export type ConfirmState = 'closed' | 'open' | 'deleting' | 'error'

/**
 * C5: the code + QR (console link carrying the citizen code), then what the code has been used for: every
 * company that opened this profile's data (counted from its receipts), the totals, the citizen's rights
 * under UU PDP, and the data actions (download all receipts, delete). Purely presentational.
 * Phone: one column. Laptop (≥ 1024 px shell): identity column left (sticky), sections right.
 */
export function ProfileScreenView({
  state,
  profile,
  receipts = NO_RECEIPTS,
  verdicts,
  deleted = 0,
  now = 0,
  error,
  confirm,
  deleteError,
  modal = true,
  onCopy,
  onAskDelete,
  onCancelDelete,
  onDeleteDemo,
  onDownloadAll,
  onRetry,
}: {
  state: ProfileState
  profile: CitizenProfile | null
  /** This profile's receipts (GET /api/citizen/receipts). */
  receipts?: ReceiptOpening[]
  /** This browser's chain verdict per eventId (same shape as the receipts list). */
  verdicts?: AutoVerdicts
  /** Receipts gone from the agency's database (ghosts plus hidden), as on the list. */
  deleted?: number
  now?: number
  error?: string | null
  confirm: ConfirmState
  deleteError?: string | null
  /** false renders the confirm dialog inline (dev gallery) instead of as a native modal. */
  modal?: boolean
  onCopy: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onDeleteDemo: () => void
  onDownloadAll?: () => void
  onRetry: () => void
}) {
  if (state === 'loading') {
    return (
      <div className="@5xl:mx-auto @5xl:w-full @5xl:max-w-[1180px] @5xl:px-10 @5xl:py-9">
        <ProfileSkeleton />
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col gap-4 @5xl:max-w-[720px] @5xl:px-10 @5xl:py-9">
        <Quiet
          glyph="clock"
          title="Couldn't load your profile"
          body={error ?? 'Something went wrong.'}
          action={
            <Act variant="light" size="md" icon={<IconRefresh size={15} />} onClick={onRetry}>
              Try again
            </Act>
          }
        />
        <TabBar />
      </div>
    )
  }

  if (state === 'none' || !profile) {
    return (
      <div className="flex flex-col gap-4 @5xl:max-w-[720px] @5xl:px-10 @5xl:py-9">
        <Quiet
          glyph="eye"
          title="No profile yet"
          body="Create a synthetic profile to get a code agencies can log against."
          action={<Cta href="/citizen">Create profile</Cta>}
        />
        <TabBar />
      </div>
    )
  }

  const { code, displayName } = profile
  const rows = aggregateAccess(receipts, verdicts)
  const totals = accessTotals(rows)

  return (
    <div className="flex flex-col gap-6 @5xl:mx-auto @5xl:grid @5xl:w-full @5xl:max-w-[1120px] @5xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] @5xl:items-start @5xl:gap-x-12 @5xl:px-10 @5xl:py-9 @7xl:gap-x-16">
      <div className="flex flex-col gap-6 @5xl:sticky @5xl:top-9">
        <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">Profile</h1>

        {/* Identity: the Citizen Pass at full size (riset-ui/36 A). The code (Doto) and the QR live on its stub. */}
        <section aria-label="Your code" className="flex flex-col gap-3">
          <CitizenPass code={code} size="full" onCopy={onCopy} {...passStatus(receipts, verdicts, deleted)} />
          <div className="px-1">
            <p className="text-[15px] font-medium text-ink">{displayName}</p>
            <p className="mt-0.5 text-[13px] text-ink-2">Synthetic profile · no name, ID number or wallet</p>
          </div>
          <Act full icon={<IconCopy size={16} />} onClick={onCopy}>
            Copy code
          </Act>
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-6 @5xl:gap-8">
        <ProfileGroup id="access-title" title="Who has opened your data" lead="Counted from your receipts. Your phone checks each one against the sealed record.">
          <AccessTotalsStrip totals={totals} />
          <AccessList rows={rows} now={now} />
        </ProfileGroup>

        <ProfileGroup
          id="rights-title"
          title="Your rights under UU PDP"
          lead="Law 27/2022 on Personal Data Protection. Saksi does not file requests for you. Your receipts are the evidence when you do."
        >
          <RightsList />
        </ProfileGroup>

        <ProfileGroup id="data-title" title="Data">
          <DataActions count={receipts.length} onDownloadAll={onDownloadAll} onAskDelete={onAskDelete} />
        </ProfileGroup>
      </div>

      <ConfirmDelete
        code={code}
        state={confirm}
        error={deleteError}
        modal={modal}
        onCancel={onCancelDelete}
        onConfirm={onDeleteDemo}
      />

      <TabBar />
    </div>
  )
}


/** The pass's one-sentence verdict over every receipt on this profile. Red only when a record was altered or deleted. */
function passStatus(receipts: ReceiptOpening[], verdicts: AutoVerdicts | undefined, deleted: number): { verdict: PassVerdict; title: string; subtitle: string } {
  const v = verdicts ?? {}
  const altered = receipts.filter((r) => v[r.eventId] === 'altered').length
  const checking = receipts.filter((r) => v[r.eventId] === 'verifying').length
  const matched = receipts.filter((r) => v[r.eventId] === 'match').length
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`
  if (altered || deleted) return { verdict: 'tamper', title: tamperTitle(altered, deleted), subtitle: 'Your phone caught it, not Saksi’s server.' }
  if (checking) return { verdict: 'checking', title: `Checking ${n(checking, 'receipt', 'receipts')} against the public ledger`, subtitle: 'Your phone is checking, not our server.' }
  if (!receipts.length) return { verdict: 'empty', title: 'No receipts yet', subtitle: 'Show your code to an agency to try it.' }
  if (matched)
    return {
      verdict: 'ok',
      title: matched === receipts.length ? (matched === 1 ? 'Your receipt matches the sealed record' : `All ${matched} receipts match the sealed record`) : `${matched} of ${receipts.length} receipts match the sealed record`,
      subtitle: 'Checked by your phone, not by Saksi’s server.',
    }
  return { verdict: 'empty', title: n(receipts.length, 'receipt on record', 'receipts on record'), subtitle: 'Your phone checks each one once it is sealed.' }
}

function Quiet({ glyph, title, body, action }: { glyph: 'clock' | 'eye'; title: string; body: string; action?: ReactNode }) {
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

function ConfirmDelete({
  code,
  state,
  error,
  modal,
  onCancel,
  onConfirm,
}: {
  code: string
  state: ConfirmState
  error?: string | null
  modal: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const open = state !== 'closed'

  useEffect(() => {
    const d = ref.current
    if (!modal || !d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open, modal])

  const body = (
    <div className="p-5">
      <h2 id="del-title" className="text-[20px] font-medium tracking-[-0.02em]">
        Delete this profile?
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
        Your code <span className="font-mono text-ink">{code}</span> stops working, and this profile and its link to your
        receipts are removed. The receipts are unlinked, not erased: the public ledger keeps only fingerprints nobody can
        tie back to you. This cannot be undone.
      </p>
      {state === 'error' ? (
        <p role="alert" className="mt-3 flex items-start gap-2 border-y border-line-strong py-2.5 text-[14px] text-ink-2">
          <IconAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong className="block font-semibold text-ink">Not deleted</strong>
            {error ?? 'Something went wrong.'}
          </span>
        </p>
      ) : null}
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <Act variant="light" size="md" full onClick={onCancel} disabled={state === 'deleting'}>
          Cancel
        </Act>
        <Act size="md" full arrow={false} loading={state === 'deleting'} disabled={state === 'deleting'} onClick={onConfirm}>
          {state === 'deleting' ? 'Deleting…' : state === 'error' ? 'Try again' : 'Delete'}
        </Act>
      </div>
    </div>
  )

  const card = 'w-[calc(100%-32px)] max-w-[380px] rounded-xl border border-line bg-paper p-0'

  if (!modal) {
    if (!open) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50">
        <div role="dialog" aria-modal="true" aria-labelledby="del-title" className={card}>
          {body}
        </div>
      </div>
    )
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="del-title"
      className={`m-auto backdrop:bg-ink/50 ${card}`}
      onCancel={(e) => {
        e.preventDefault()
        if (state !== 'deleting') onCancel()
      }}
    >
      {body}
    </dialog>
  )
}
