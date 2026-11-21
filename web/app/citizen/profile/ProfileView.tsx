'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { useMemo, useEffect, useRef, useState, type ReactNode } from 'react'
import { Act } from '@/components/citizen/Act'
import { accessTotals, aggregateAccess, downloadReceiptsJson } from '@/components/citizen-workspace/access'
import { AccessList, AccessTotalsStrip, ProfileSection, RightsList } from '@/components/citizen-workspace/ProfileSections'
import { Cta } from '@/components/landing/Cta'
import { DotoValue } from '@/components/ui/DotoValue'
import { RiseHeading } from '@/components/citizen/motion'
import { DotIcon } from '@/components/ui/DotIcon'
import { IconAlert, IconCopy, IconDownload, IconRefresh, IconTrash } from '@/components/ui/icons'
import { ProfileSkeleton } from '@/components/ui/Skeleton'
import { TabBar } from '@/components/ui/TabBar'
import { useToast } from '@/components/ui/Toast'
import { checkOf, useAutoVerify, useReceiptChecks } from '@/lib/client/receipt-checks'
import { forgetSeenReceipts } from '@/lib/client/seen-receipts'
import { copyText, deleteProfile, toCitizenError, type AutoVerdicts, type CitizenProfile } from '@/lib/data'
import { SITE_URL } from '@/lib/env'
import { controllerLinkForCode } from '@/lib/format'
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
  const del = useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => {
      forgetSeenReceipts()
      setConfirmOpen(false)
      qc.removeQueries({ queryKey: ['receipts'] })
      qc.removeQueries({ queryKey: ['profile'] })
      toast('Demo profile deleted')
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
      state={q.isPending ? 'loading' : noSession ? 'none' : q.isError ? 'error' : q.data ? 'ready' : 'none'}
      profile={q.data?.profile ?? null}
      receipts={receipts}
      verdicts={verdicts}
      now={now}
      error={q.isError && !noSession ? toCitizenError(q.error).message : null}
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
          title="No demo profile yet"
          body="Create a synthetic profile to get a code companies can log against."
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
    <div className="flex flex-col gap-5 @5xl:mx-auto @5xl:grid @5xl:w-full @5xl:max-w-[1180px] @5xl:grid-cols-[minmax(272px,320px)_minmax(0,1fr)] @5xl:items-start @5xl:gap-x-12 @5xl:px-10 @5xl:py-9 @7xl:gap-x-16">
      <div className="flex flex-col gap-5 @5xl:sticky @5xl:top-9">
        <RiseHeading as="h1" lead="Your code." tail="Show it to a company." className="text-[34px] leading-[1.04] text-ink" />

        <section aria-label="Profile QR code" className="anim-rise flex flex-col items-center border-y border-line py-6">
          <div className="w-full max-w-[236px] @5xl:max-w-[200px]">
            {/* An absolute link, so any phone camera opens the console with this code filled in. */}
            <QRCodeSVG
              value={controllerLinkForCode(SITE_URL, code)}
              size={512}
              level="M"
              bgColor="#F4F2EC"
              fgColor="#1E1A16"
              className="h-auto w-full"
              title={`QR code: opens the controller console with code ${code}`}
            />
          </div>
          <p className="mt-6 text-center text-[52px] leading-[0.9] text-ink @5xl:text-[44px]">
            <DotoValue value={code} className="gap-[0.06em]" />
          </p>
          <p className="label mt-2.5 text-center text-[11px] text-ink-2">{displayName}</p>
        </section>

        <Act full icon={<IconCopy size={16} />} onClick={onCopy}>
          Copy code
        </Act>

        <ul data-stagger="" className="grid grid-cols-3 border-y border-line">
          {['No name', 'No ID number', 'No wallet'].map((t, i) => (
            <li key={t} className={`label flex min-h-11 items-center justify-center text-center text-[11px] text-ink-2 ${i ? 'border-l border-line' : ''}`}>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="@container/side mt-4 flex min-w-0 flex-col gap-10 @5xl:mt-0 @5xl:gap-12">
        <ProfileSection
          id="access-title"
          title="Who has opened your data"
          lead="Counted from your receipts. Your phone checks each one against the chain."
        >
          <div className="flex flex-col gap-5">
            <AccessTotalsStrip totals={totals} />
            <AccessList rows={rows} now={now} />
          </div>
        </ProfileSection>

        <ProfileSection
          id="rights-title"
          title="Your rights under UU PDP"
          lead="Law 27/2022 on Personal Data Protection. Saksi does not file requests for you. Your receipts are the evidence when you do."
        >
          <RightsList />
        </ProfileSection>

        <ProfileSection id="data-title" title="Your data">
          <div className="flex flex-col border-t border-line">
            <div className="flex flex-col gap-3 border-b border-line py-4 @xl/side:flex-row @xl/side:items-center @xl/side:justify-between @xl/side:gap-8">
              <div className="min-w-0">
                <p className="text-[15px] font-medium leading-snug text-ink">Download all receipts</p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-ink-2">
                  {receipts.length === 0
                    ? 'Nothing to download yet.'
                    : `One JSON file with ${receipts.length === 1 ? 'your receipt' : `all ${receipts.length} receipts`}. Each can be re-checked at /proof.`}
                </p>
              </div>
              <Act
                variant="light"
                size="md"
                className="w-full justify-center @xl/side:w-auto"
                icon={<IconDownload size={15} />}
                onClick={onDownloadAll ?? noop}
                disabled={receipts.length === 0 || !onDownloadAll}
              >
                Download JSON
              </Act>
            </div>
            <div className="flex flex-col gap-3 py-4 @xl/side:flex-row @xl/side:items-center @xl/side:justify-between @xl/side:gap-8">
              <div className="min-w-0">
                <p className="text-[15px] font-medium leading-snug text-ink">Delete demo profile</p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-ink-2">
                  Removes your synthetic profile and receipts from our database. Fingerprints already sealed on chain
                  stay there. They reveal nothing about you.
                </p>
              </div>
              <Act variant="light" size="md" className="w-full justify-center @xl/side:w-auto" icon={<IconTrash size={15} />} onClick={onAskDelete}>
                Delete profile
              </Act>
            </div>
          </div>
        </ProfileSection>
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

const noop = () => {}

function Quiet({ glyph, title, body, action }: { glyph: 'clock' | 'eye'; title: string; body: string; action?: ReactNode }) {
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
        Delete this demo profile?
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
        Your code <span className="font-mono text-ink">{code}</span> stops working and its receipts leave our database.
        The sealed fingerprints stay on chain. This cannot be undone.
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
