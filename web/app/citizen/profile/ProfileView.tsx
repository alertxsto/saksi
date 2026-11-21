'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef, useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Chip, TwoTone } from '@/components/ui/Chip'
import { DotoValue } from '@/components/ui/DotoValue'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconAlert, IconCopy, IconRefresh, IconTrash, IconUser } from '@/components/ui/icons'
import { RegMarks } from '@/components/ui/RegMarks'
import { ProfileSkeleton } from '@/components/ui/Skeleton'
import { TabBar } from '@/components/ui/TabBar'
import { useToast } from '@/components/ui/Toast'
import { copyText, deleteProfile, getProfile, toCitizenError, type CitizenProfile } from '@/lib/data'

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
      toast('Copy failed', 'bad')
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

/** C5: QR of the citizen code, copy, delete with confirmation. Purely presentational. */
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
        <EmptyState
          tone="neutral"
          icon={<IconAlert size={20} />}
          title="Couldn't load your profile"
          body={error ?? 'Something went wrong.'}
          action={
            <Button variant="light" size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>
              Try again
            </Button>
          }
        />
        <TabBar />
      </div>
    )
  }

  if (state === 'none' || !profile) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          icon={<IconUser size={20} />}
          title="No demo profile yet"
          body="Create a synthetic profile to get a code companies can log against."
          action={
            <ButtonLink href="/citizen" variant="dark" arrow size="sm">
              Create profile
            </ButtonLink>
          }
        />
        <TabBar />
      </div>
    )
  }

  const { code, displayName } = profile

  return (
    <div className="flex flex-col gap-5">
      <TwoTone as="h1" head="Your code." tail="Show it to a company." className="text-[32px]" />

      <section aria-label="Profile QR code" className="relative rounded-xl border border-line bg-card p-6">
        <RegMarks className="bg-blue" size={8} />
        <div className="mx-auto w-full max-w-[260px]">
          <QRCodeSVG
            value={code}
            size={512}
            level="M"
            bgColor="#FBFAF7"
            fgColor="#1E1A16"
            className="h-auto w-full"
            title={`QR code for profile ${code}`}
          />
        </div>
        <p className="mt-6 text-center text-[52px] leading-[0.9] text-ink">
          <DotoValue value={code} className="gap-[0.06em]" />
        </p>
        <p className="label mt-2 text-center text-ink-2">{displayName}</p>
      </section>

      <Button variant="dark" arrow full onClick={onCopy} icon={<IconCopy size={16} />}>
        Copy code
      </Button>

      <div className="flex flex-wrap gap-2">
        <Chip>No name</Chip>
        <Chip>No ID number</Chip>
        <Chip>No wallet</Chip>
      </div>

      <div className="mt-2 border-t border-dashed border-line-strong pt-5">
        <p className="text-[14px] leading-relaxed text-ink-2">
          Deleting removes your synthetic profile and receipts from our database. Fingerprints already sealed on chain
          stay there — they reveal nothing about you.
        </p>
        <Button variant="danger" full className="mt-3" icon={<IconTrash size={16} />} onClick={onAskDelete}>
          Delete demo profile
        </Button>
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
        Your code <span className="font-mono text-ink">{code}</span> stops working. This cannot be undone.
      </p>
      {state === 'error' ? (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-line-strong bg-card p-2.5 text-[14px] text-ink-2">
          <IconAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong className="block font-semibold text-ink">Not deleted</strong>
            {error ?? 'Something went wrong.'}
          </span>
        </p>
      ) : null}
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <Button variant="light" size="sm" onClick={onCancel} disabled={state === 'deleting'}>
          Cancel
        </Button>
        <Button variant="danger" size="sm" loading={state === 'deleting'} disabled={state === 'deleting'} onClick={onConfirm}>
          {state === 'deleting' ? 'Deleting…' : state === 'error' ? 'Try again' : 'Delete'}
        </Button>
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
