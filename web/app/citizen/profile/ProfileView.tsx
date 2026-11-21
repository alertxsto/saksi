'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Act } from '@/components/citizen/Act'
import { Cta } from '@/components/landing/Cta'
import { DotoValue } from '@/components/ui/DotoValue'
import { RiseHeading } from '@/components/citizen/motion'
import { DotIcon } from '@/components/ui/DotIcon'
import { IconAlert, IconCopy, IconRefresh, IconTrash } from '@/components/ui/icons'
import { ProfileSkeleton } from '@/components/ui/Skeleton'
import { TabBar } from '@/components/ui/TabBar'
import { useToast } from '@/components/ui/Toast'
import { forgetSeenReceipts } from '@/lib/client/seen-receipts'
import { copyText, deleteProfile, getProfile, toCitizenError, type CitizenProfile } from '@/lib/data'
import { SITE_URL } from '@/lib/env'
import { controllerLinkForCode } from '@/lib/format'

/** Container: loads the profile (GET /api/citizen/receipts) and owns delete (DELETE /api/citizen/session). */
export function ProfileView() {
  const { toast } = useToast()
  const router = useRouter()
  const qc = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const q = useQuery({ queryKey: ['profile'], queryFn: getProfile })
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

  const code = q.data?.code ?? ''
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

  return (
    <ProfileScreenView
      state={q.isPending ? 'loading' : q.isError ? 'error' : q.data ? 'ready' : 'none'}
      profile={q.data ?? null}
      error={q.isError ? toCitizenError(q.error).message : null}
      confirm={!confirmOpen ? 'closed' : del.isPending ? 'deleting' : del.isError ? 'error' : 'open'}
      deleteError={del.isError ? toCitizenError(del.error).message : null}
      onCopy={() => void onCopy()}
      onAskDelete={() => {
        del.reset()
        setConfirmOpen(true)
      }}
      onCancelDelete={() => setConfirmOpen(false)}
      onDeleteDemo={onDeleteDemo}
      onRetry={onRetry}
    />
  )
}

export type ProfileState = 'loading' | 'none' | 'error' | 'ready'
export type ConfirmState = 'closed' | 'open' | 'deleting' | 'error'

/** C5: QR (console link carrying the citizen code), copy, delete with confirmation. Purely presentational. */
export function ProfileScreenView({
  state,
  profile,
  error,
  confirm,
  deleteError,
  modal = true,
  onCopy,
  onAskDelete,
  onCancelDelete,
  onDeleteDemo,
  onRetry,
}: {
  state: ProfileState
  profile: CitizenProfile | null
  error?: string | null
  confirm: ConfirmState
  deleteError?: string | null
  /** false renders the confirm dialog inline (dev gallery) instead of as a native modal. */
  modal?: boolean
  onCopy: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onDeleteDemo: () => void
  onRetry: () => void
}) {
  if (state === 'loading') return <ProfileSkeleton />

  if (state === 'error') {
    return (
      <div className="flex flex-col gap-4">
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
      <div className="flex flex-col gap-4">
        <Quiet
          glyph="eye"
          title="No demo profile yet"
          body="Create a synthetic profile to get a code companies can log against."
          action={
            <Cta href="/citizen">Create profile</Cta>
          }
        />
        <TabBar />
      </div>
    )
  }

  const { code, displayName } = profile

  return (
    <div className="flex flex-col gap-5">
      <RiseHeading as="h1" lead="Your code." tail="Show it to a company." className="text-[34px] leading-[1.04] text-ink" />

      <section aria-label="Profile QR code" className="anim-rise flex flex-col items-center border-y border-line py-6">
        <div className="w-full max-w-[236px]">
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
        <p className="mt-6 text-center text-[52px] leading-[0.9] text-ink">
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

      <div className="pt-1">
        <p className="text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2">
          Deleting removes your synthetic profile and receipts from our database. Fingerprints already sealed on chain
          stay there — they reveal nothing about you.
        </p>
        <Act variant="light" full className="mt-3" icon={<IconTrash size={16} />} onClick={onAskDelete}>
          Delete demo profile
        </Act>
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
