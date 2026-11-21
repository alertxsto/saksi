'use client'

import { useId, useState } from 'react'
import { stringToHex } from 'viem'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { IconLock } from '@/components/ui/icons'
import { ReceiptCard } from '@/components/ui/ReceiptCard'
import { useNow } from '@/lib/hooks'
import {
  EVENT_LABELS,
  EVENT_TYPES,
  LEGAL_BASES,
  LEGAL_BASIS_KEYS,
  type EventTypeCode,
  type LegalBasisKey,
  type ReceiptOpening,
} from '@/lib/shared/types'

/** What onSeal receives. Add controllerId and it is RecordAccessInput (lib/client/controller.ts). */
export type AccessFormValues = {
  subjectCode: string
  eventType: EventTypeCode
  purposeText: string
  legalBasisKey: LegalBasisKey
}

const BASIS_HINT: Record<LegalBasisKey, string> = {
  'PDP-20-2-a': 'The citizen agreed explicitly',
  'PDP-20-2-b': 'Needed to deliver a contract',
  'PDP-20-2-c': 'Required by law',
  'PDP-20-2-d': 'Protects someone’s life',
  'PDP-20-2-e': 'Public interest or official task',
  'PDP-20-2-f': 'Balanced business interest',
}

/** Citizen code alphabet (same as lib/server/citizen.ts): no 0, O, 1 or I. */
const CODE_ALPHABET = /^[A-HJ-NP-Z2-9]*$/
export const PURPOSE_MAX = 120
const PURPOSE_MIN = 3

export function codeError(code: string): string | null {
  if (!code) return 'Enter the 6-character code the citizen shows you.'
  if (!CODE_ALPHABET.test(code)) return 'Codes never use 0, O, 1 or I. Check the code again.'
  if (code.length < 6) return `${code.length} of 6 characters.`
  return null
}

export function purposeError(purpose: string): string | null {
  if (purpose.trim().length < PURPOSE_MIN) return 'Say why you opened this data (at least 3 characters).'
  if (purpose.length > PURPOSE_MAX) return `Keep it under ${PURPOSE_MAX} characters.`
  return null
}

export const DEFAULT_ACCESS_VALUES: AccessFormValues = {
  subjectCode: '',
  eventType: 0,
  purposeText: '',
  legalBasisKey: 'PDP-20-2-b',
}

/**
 * Record-access form + live "What the citizen will see" preview. Field state lives here; the
 * parent only gets validated values through onSeal.
 */
export function RecordAccessForm({
  controllerName,
  initial,
  showErrors = false,
  busy = false,
  onSeal,
}: {
  controllerName: string
  initial?: Partial<AccessFormValues>
  /** Show validation messages before the first submit (dev gallery). */
  showErrors?: boolean
  busy?: boolean
  onSeal: (values: AccessFormValues) => void
}) {
  const [v, setV] = useState<AccessFormValues>({ ...DEFAULT_ACCESS_VALUES, ...initial })
  const [touched, setTouched] = useState(showErrors)
  const now = useNow()
  const ids = { code: useId(), purpose: useId(), basis: useId() }

  const cErr = codeError(v.subjectCode)
  const pErr = purposeError(v.purposeText)
  const valid = !cErr && !pErr
  const set = (patch: Partial<AccessFormValues>) => setV((cur) => ({ ...cur, ...patch }))

  const preview: ReceiptOpening = {
    eventId: 'preview',
    controllerId: '0x',
    controllerName,
    subjectPseudonym: '0x',
    purposeText: v.purposeText.trim() || 'Your purpose appears here',
    purposeSalt: '0x',
    legalBasisKey: stringToHex(v.legalBasisKey, { size: 32 }),
    eventType: v.eventType,
    evidence: {},
    txHash: null,
    logIndex: null,
    status: 'pending',
    createdAt: new Date(now || 0).toISOString(),
  }

  const onSubmit = () => {
    setTouched(true)
    if (!valid || busy) return
    onSeal({ ...v, purposeText: v.purposeText.trim() })
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        className="flex flex-col gap-6 rounded-lg border border-line bg-card p-5 md:p-6"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        noValidate
      >
        <div>
          <label htmlFor={ids.code} className="label text-ink">
            Citizen code
          </label>
          <input
            id={ids.code}
            value={v.subjectCode}
            onChange={(e) => set({ subjectCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) })}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={touched && Boolean(cErr)}
            aria-describedby={`${ids.code}-h`}
            className="mt-2 h-14 w-full rounded-md border border-line-strong bg-paper-2 px-4 font-mono text-[24px] tracking-[0.3em] text-ink outline-none placeholder:text-ink-3 focus:border-blue aria-[invalid=true]:border-pending"
            placeholder="K7M2QD"
          />
          <p id={`${ids.code}-h`} className={`mt-1.5 text-[13px] ${touched && cErr ? 'text-pending' : 'text-ink-2'}`}>
            {touched && cErr ? cErr : 'The 6-character code the citizen shows you. Letters are capitalised for you.'}
          </p>
        </div>

        <fieldset>
          <legend className="label text-ink">Access type</legend>
          <div
            className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line-strong bg-line-strong sm:grid-cols-4"
            role="radiogroup"
            aria-label="Access type"
          >
            {EVENT_TYPES.map((name, i) => {
              const code = i as EventTypeCode
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={v.eventType === code}
                  onClick={() => set({ eventType: code })}
                  className={`label min-h-12 px-2 text-[11px] leading-tight transition-colors ${
                    v.eventType === code ? 'bg-ink text-paper' : 'bg-card text-ink-2 hover:text-ink'
                  }`}
                >
                  {EVENT_LABELS[name].toUpperCase()}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor={ids.purpose} className="label text-ink">
              Purpose
            </label>
            <span className={`tnum font-mono text-[12px] ${v.purposeText.length >= PURPOSE_MAX ? 'text-pending' : 'text-ink-2'}`}>
              {v.purposeText.length}/{PURPOSE_MAX}
            </span>
          </div>
          <input
            id={ids.purpose}
            value={v.purposeText}
            maxLength={PURPOSE_MAX}
            onChange={(e) => set({ purposeText: e.target.value })}
            aria-invalid={touched && Boolean(pErr)}
            aria-describedby={`${ids.purpose}-h`}
            className="mt-2 h-12 w-full rounded-md border border-line-strong bg-paper-2 px-4 text-[16px] text-ink outline-none placeholder:text-ink-3 focus:border-blue aria-[invalid=true]:border-pending"
            placeholder="e.g. Debt collection"
          />
          <p id={`${ids.purpose}-h`} className={`mt-1.5 text-[13px] ${touched && pErr ? 'text-pending' : 'text-ink-2'}`}>
            {touched && pErr ? pErr : 'Plain words. The citizen reads exactly this.'}
          </p>
        </div>

        <div>
          <label htmlFor={ids.basis} className="label text-ink">
            Legal basis · UU PDP Art. 20(2)
          </label>
          <div className="mt-2 flex flex-col items-start gap-2">
            <select
              id={ids.basis}
              value={v.legalBasisKey}
              onChange={(e) => set({ legalBasisKey: e.target.value as LegalBasisKey })}
              aria-describedby={`${ids.basis}-h`}
              className="h-12 w-full rounded-md border border-line-strong bg-paper-2 px-3 text-[16px] text-ink outline-none focus:border-blue"
            >
              {LEGAL_BASIS_KEYS.map((k) => (
                <option key={k} value={k}>
                  ({k.slice(-1)}) {LEGAL_BASES[k]}
                </option>
              ))}
            </select>
            <span id={`${ids.basis}-h`}>
              <Chip tone="blue">{BASIS_HINT[v.legalBasisKey]}</Chip>
            </span>
          </div>
        </div>

        <p className="flex items-center gap-2 border-t border-dashed border-line-strong pt-4 text-[14px] text-ink-2">
          <IconLock size={15} className="shrink-0" /> Only a pseudonym and a fingerprint go on-chain. No names, no ID numbers.
        </p>

        <Button type="submit" variant="dark" size="lg" arrow loading={busy} disabled={busy}>
          {busy ? 'Sealing…' : 'Seal on chain'}
        </Button>
      </form>

      <div>
        <p className="label mb-3 text-ink-2">What the citizen will see</p>
        <div className="flex max-w-[420px] flex-col gap-2" inert>
          <ReceiptCard opening={preview} now={now} isNew />
          <p className="label px-1 text-[11px] text-ink-2">
            Legal basis · {LEGAL_BASES[v.legalBasisKey]} ({v.legalBasisKey})
          </p>
        </div>
      </div>
    </div>
  )
}
