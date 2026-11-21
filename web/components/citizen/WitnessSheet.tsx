'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Act } from '@/components/citizen/Act'
import { initials } from '@/components/citizen/ReceiptRows'
import { IconCheck, IconX } from '@/components/ui/icons'
import { LogoMark } from '@/components/ui/Logo'
import '@/app/citizen/stub-list.css'
import '@/app/citizen/witness.css'

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Bottom sheet on phones, centred dialog from 1024 px (riset-ui/37 §4 "bottom sheets instead of modals").
 * Native <dialog> so focus is trapped and Esc works; opens in 320 ms, leaves in 220 ms, instant under
 * reduced motion. Controlled: `open` drives it, every dismissal goes through `onClose`.
 */
export function CitizenSheet({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.removeAttribute('data-closing')
      d.showModal()
      return
    }
    if (!open && d.open) {
      if (reduced()) {
        d.close()
        return
      }
      d.setAttribute('data-closing', '')
      const t = window.setTimeout(() => {
        d.removeAttribute('data-closing')
        d.close()
      }, 220)
      return () => window.clearTimeout(t)
    }
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      className="wt-sheet"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex justify-center pt-2.5 lg:hidden" aria-hidden="true">
        <span className="wt-grab" />
      </div>
      {children}
    </dialog>
  )
}

function SheetClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-ink-2 transition-colors duration-150 hover:bg-ink/[.06] hover:text-ink"
    >
      <IconX size={17} />
    </button>
  )
}

// ---------------------------------------------------------------------------------------------
// How Saksi witnesses: three steps, each with a tiny stub of what it produces.
// ---------------------------------------------------------------------------------------------

/** Mini stub (the receipt-row anatomy at 60%): a time side, a perforation, one line. */
function MiniStub({ side, title, line, tone = 'card', end }: { side: string; title: string; line: string; tone?: 'card' | 'vault'; end?: ReactNode }) {
  const vault = tone === 'vault'
  return (
    <div className="sl-shadow-sm">
      <div
        className={`sl-stub relative flex min-h-[52px] items-stretch rounded-[12px] ${vault ? 'bg-vault text-vault-ink' : 'bg-card text-ink'}`}
        style={{ '--cut': '54px', '--r': '5px' } as CSSProperties}
      >
        <span className={`tnum flex w-[54px] shrink-0 items-center justify-center text-[13px] font-semibold ${vault ? 'text-vault-ink' : 'text-ink'}`}>{side}</span>
        <span aria-hidden="true" className={`sl-perf-v absolute bottom-2 left-[53px] top-2 ${vault ? 'text-vault-ink-2/40' : 'text-line-strong'}`} />
        <span className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 pr-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold leading-snug">{title}</span>
            <span className={`block truncate text-[12px] leading-snug ${vault ? 'text-vault-ink-2' : 'text-ink-2'}`}>{line}</span>
          </span>
          {end}
        </span>
      </div>
    </div>
  )
}

/** The witness stamp in miniature for step 3 (static: the real one lands on the receipt). */
function MiniStamp() {
  return (
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 -rotate-12 items-center justify-center rounded-full border-[1.5px] border-ok text-ok">
      <IconCheck size={14} strokeWidth={2.8} />
    </span>
  )
}

const STEPS: Array<{ n: string; title: string; body: string; visual: ReactNode }> = [
  {
    n: '1',
    title: 'The agency records the access',
    body: 'When an agency opens your record it must log who, why and under which legal basis (UU PDP Pasal 20).',
    visual: <MiniStub side="00:25" title="RSUD Contoh (fiktif)" line="Read your data · service request" />,
  },
  {
    n: '2',
    title: 'Saksi seals it on a public ledger',
    body: 'Saksi notarises that log as a fingerprint on a public ledger. Saksi never holds your data, only the seal.',
    visual: (
      <MiniStub
        tone="vault"
        side="Sealed"
        title="Witnessed by Saksi"
        line="Sealed on the public ledger · 22 Nov 00:25"
        end={
          <span className="h-6 w-6 shrink-0">
            <LogoMark size={24} tone="vault" />
          </span>
        }
      />
    ),
  },
  {
    n: '3',
    title: 'Your phone checks it',
    body: 'Your phone compares the agency’s record with the seal. If anyone quietly changes or deletes it later, this app turns red.',
    visual: <MiniStub side="Phone" title="Matches the sealed record" line="All 6 fields compared · just now" end={<MiniStamp />} />,
  },
]

/** "How Saksi witnesses": the quiet explainer, reached from the home footer and the first-run sheet. */
export function HowSaksiWitnesses({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <CitizenSheet open={open} onClose={onClose} labelledBy="how-title">
      <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-3 lg:pt-5">
        <div>
          <h2 id="how-title" className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
            How Saksi witnesses
          </h2>
          <p className="mt-1 text-[14px] leading-snug text-ink-2">A neutral witness between the agencies that hold your data and you.</p>
        </div>
        <SheetClose onClose={onClose} />
      </div>
      <ol className="flex flex-col gap-5 px-5 pb-2 pt-4">
        {STEPS.map((s, i) => (
          <li key={s.n} className="wt-step grid grid-cols-[28px_minmax(0,1fr)] gap-x-3" style={{ '--i': i } as CSSProperties}>
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-paper">
              {s.n}
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold leading-snug text-ink">{s.title}</h3>
              <p className="mt-0.5 text-[14px] leading-[1.5] text-ink-2">{s.body}</p>
              <div className="mt-2.5">{s.visual}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
        <p className="mb-3 text-[13px] leading-snug text-ink-3">So nobody, not the agency and not Saksi, can quietly change what happened.</p>
        <div className="mb-4">
          <NikNote />
        </div>
        <Act full arrow={false} onClick={onClose}>
          Got it
        </Act>
      </div>
    </CitizenSheet>
  )
}

// ---------------------------------------------------------------------------------------------
// First run: who you are in this session.
// ---------------------------------------------------------------------------------------------

/** How receipts find you without a NIK (owner's question, 22 Nov). Shared by both sheets. */
function NikNote() {
  return (
    <p className="rounded-[14px] bg-paper-2/70 px-3.5 py-3 text-[13px] leading-[1.5] text-ink-2">
      Your code stands in for your NIK in this prototype. In production you sign in with IKD (KTP digital). Agencies already know the NIK
      they looked up, and Saksi matches the receipt to you through a pseudonym that is different for each agency.{' '}
      <span className="font-medium text-ink">Your NIK never goes on the public ledger.</span>
    </p>
  )
}

const SEEN_KEY = (code: string) => `saksi.citizen.welcomed.${code}`

/** True once per session code per browser (localStorage). Storage failures just skip the sheet. */
export function useFirstRun(code: string, enabled: boolean): [boolean, () => void] {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!enabled || !code) return
    try {
      if (!window.localStorage.getItem(SEEN_KEY(code))) setShow(true)
    } catch {
      // private mode / blocked storage: no first-run sheet
    }
  }, [code, enabled])
  const dismiss = () => {
    setShow(false)
    try {
      window.localStorage.setItem(SEEN_KEY(code), String(Date.now()))
    } catch {
      // ignore
    }
  }
  return [show, dismiss]
}

/** One-time identity sheet: you are a synthetic citizen, no real person, this is your code. */
export function IdentitySheet({
  open,
  name,
  code,
  onClose,
  onShowHow,
}: {
  open: boolean
  name: string
  code: string
  onClose: () => void
  onShowHow: () => void
}) {
  return (
    <CitizenSheet open={open} onClose={onClose} labelledBy="identity-title">
      <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 lg:pt-6">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-paper-2 text-[16px] font-semibold text-ink">
            {initials(name)}
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-[3px] border-paper bg-ink" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] text-ink-3">Citizen · synthetic</p>
            <p className="truncate text-[17px] font-semibold leading-snug text-ink">{name}</p>
          </div>
        </div>
        <h2 id="identity-title" className="mt-5 text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] text-ink">
          You are {name}, a synthetic citizen created for this session.
        </h2>
        <p className="mt-2 text-[15px] leading-[1.55] text-ink-2">No real person or data. Agencies send receipts to your code, and Saksi witnesses each one.</p>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-[16px] bg-vault px-4 py-3.5 text-vault-ink">
          <span className="text-[13px] text-vault-ink-2">Your code</span>
          <span className="doto text-[28px] tracking-[0.06em]">{code}</span>
        </div>
        <div className="mt-3">
          <NikNote />
        </div>
        <div className="mt-5 flex flex-col gap-1.5">
          <Act full arrow={false} onClick={onClose}>
            Got it
          </Act>
          <button
            type="button"
            onClick={onShowHow}
            className="flex min-h-11 items-center justify-center rounded-md text-[14px] font-medium text-ink-2 transition-colors duration-150 hover:text-ink"
          >
            How Saksi witnesses
          </button>
        </div>
      </div>
    </CitizenSheet>
  )
}
