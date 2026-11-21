'use client'

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { stringToHex } from 'viem'
import { OdoText } from '@/components/landing/OdoText'
import { PhonePreview } from '@/components/controller/PhonePreview'
import { Button } from '@/components/ui/Button'
import { IconLock } from '@/components/ui/icons'
import { normalizeCitizenCode } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import {
  DATA_CATEGORIES,
  DATA_CATEGORY_LABELS,
  EVENT_LABELS,
  EVENT_TYPES,
  LEGAL_BASES,
  LEGAL_BASIS_KEYS,
  type DataCategory,
  type EventTypeCode,
  type LegalBasisKey,
  type ReceiptOpening,
  type RecordStatus,
} from '@/lib/shared/types'

/** What onSeal receives. Add controllerId and it is RecordAccessInput (lib/client/controller.ts). */
export type AccessFormValues = {
  subjectCode: string
  eventType: EventTypeCode
  purposeText: string
  legalBasisKey: LegalBasisKey
  /** Which kinds of personal data the access touched (at least one). */
  dataCategories: DataCategory[]
  /** The system the record was opened in. Empty: the server uses the controller's registered name. */
  system: string
  /** A desk or role reference, never a name ("officer", "desk-07"). */
  operatorRef: string
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
const CODE_CHAR = /^[A-HJ-NP-Z2-9]$/
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

/** Same rule as operatorRef in lib/server/access.ts: a short token, so a name or ID number does not fit. */
const OPERATOR_REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/
const SYSTEM_MAX = 80

export function categoriesError(categories: readonly DataCategory[]): string | null {
  return categories.length ? null : 'Pick at least one kind of data you opened.'
}

export function sourceError(system: string, operatorRef: string): string | null {
  if (system.trim().length > SYSTEM_MAX) return `Keep the system name under ${SYSTEM_MAX} characters.`
  if (!OPERATOR_REF.test(operatorRef.trim())) return 'Officer reference: letters, digits, dot, dash or underscore, up to 32. Not a name.'
  return null
}

export const DEFAULT_ACCESS_VALUES: AccessFormValues = {
  subjectCode: '',
  eventType: 0,
  purposeText: '',
  legalBasisKey: 'PDP-20-2-b',
  dataCategories: [],
  system: '',
  operatorRef: 'officer',
}

/** Arrow keys move a radio group's selection (WAI-ARIA radio pattern). */
function arrowPick<T>(e: KeyboardEvent, list: readonly T[], current: T, pick: (v: T) => void) {
  const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
  if (!d) return
  e.preventDefault()
  const next = list[(list.indexOf(current) + d + list.length) % list.length]
  pick(next)
  const group = e.currentTarget as HTMLElement
  requestAnimationFrame(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus())
}

/** One hairline ledger row: label + hint on the left, the control on the right. */
function Row({ label, htmlFor, hint, children, as = 'div' }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode; as?: 'div' | 'fieldset' }) {
  const Tag = as
  const labelId = useId()
  return (
    <Tag
      {...(as === 'fieldset' ? { 'aria-labelledby': labelId } : {})}
      className="grid min-w-0 gap-x-8 gap-y-3 border-t border-line py-6 sm:grid-cols-[156px_1fr]"
    >
      <div className="flex flex-col gap-1.5 sm:pt-1">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="label text-[11px] text-ink">
            {label}
          </label>
        ) : (
          <p id={labelId} className="label text-[11px] text-ink">
            {label}
          </p>
        )}
        {hint ? <span className="text-[13px] leading-snug text-ink-2">{hint}</span> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </Tag>
  )
}

/** Six code slots over one real input (paste and autofill work; the input carries label + errors). */
function CodeSlots({
  id,
  value,
  invalid,
  describedBy,
  onChange,
}: {
  id: string
  value: string
  invalid: boolean
  describedBy: string
  onChange: (v: string) => void
}) {
  const [focus, setFocus] = useState(false)
  const active = Math.min(value.length, 5)
  return (
    <div className="relative max-w-[420px]">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="absolute inset-0 z-10 h-full w-full cursor-text rounded-md opacity-0"
      />
      <div aria-hidden="true" className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }, (_, i) => {
          const ch = value[i] ?? ''
          const bad = ch && !CODE_CHAR.test(ch)
          const isActive = focus && i === active && value.length < 6
          const isFull = focus && value.length === 6 && i === 5
          return (
            <span
              key={i}
              className={`relative flex h-[60px] items-center justify-center rounded-md border font-mono text-[26px] font-medium transition-[border-color,background-color] duration-150 ${
                bad
                  ? 'border-pending bg-pending-bg text-pending'
                  : isActive || isFull
                    ? 'border-blue bg-card text-ink'
                    : ch
                      ? 'border-line-strong bg-card text-ink'
                      : invalid
                        ? 'border-pending/60 bg-paper-2/60'
                        : 'border-line bg-paper-2/60'
              }`}
            >
              {ch ? <span key={ch + i} className="ctl-stamp">{ch}</span> : null}
              {isActive ? <span className="ctl-caret absolute h-7 w-[2px] rounded-full bg-blue" /> : null}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Record-access form + live "What the citizen will see" phone. Field state lives here; the parent only
 * gets validated values through onSeal. `aside` renders under the phone (the transaction chamber).
 */
export function RecordAccessForm({
  controllerName,
  initial,
  showErrors = false,
  busy = false,
  previewStatus = 'pending',
  aside,
  onSeal,
}: {
  controllerName: string
  initial?: Partial<AccessFormValues>
  /** Show validation messages before the first submit (dev gallery). */
  showErrors?: boolean
  busy?: boolean
  /** Status the preview receipt shows (mirror the transaction: anchored once it confirms). */
  previewStatus?: RecordStatus
  /** Rendered in the right column under the phone preview. */
  aside?: ReactNode
  onSeal: (values: AccessFormValues) => void
}) {
  const [v, setV] = useState<AccessFormValues>({ ...DEFAULT_ACCESS_VALUES, ...initial })
  const [touched, setTouched] = useState(showErrors)
  const now = useNow()
  const ids = { code: useId(), purpose: useId(), basis: useId(), data: useId(), system: useId(), operator: useId() }
  const formRef = useRef<HTMLFormElement>(null)

  const cErr = codeError(v.subjectCode)
  const pErr = purposeError(v.purposeText)
  const dErr = categoriesError(v.dataCategories)
  const sErr = sourceError(v.system, v.operatorRef)
  const valid = !cErr && !pErr && !dErr && !sErr
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
    evidence: { dataCategories: v.dataCategories },
    txHash: null,
    logIndex: null,
    status: previewStatus,
    createdAt: new Date(now || 0).toISOString(),
  }

  const onSubmit = () => {
    setTouched(true)
    if (!valid || busy) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    onSeal({ ...v, purposeText: v.purposeText.trim(), system: v.system.trim(), operatorRef: v.operatorRef.trim() })
  }

  const codeInvalid = touched && Boolean(cErr)
  const purposeInvalid = touched && Boolean(pErr)
  const categoriesInvalid = touched && Boolean(dErr)
  const sourceInvalid = touched && Boolean(sErr)
  // Kept in DATA_CATEGORIES order, so the same choice always hashes to the same evidence.
  const toggleCategory = (c: DataCategory) =>
    set({ dataCategories: DATA_CATEGORIES.filter((x) => (x === c ? !v.dataCategories.includes(c) : v.dataCategories.includes(x))) })

  return (
    <div className="grid gap-x-12 gap-y-12 lg:grid-cols-12">
      <form
        ref={formRef}
        className="flex min-w-0 flex-col lg:col-span-7"
        aria-label="Record an access"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        noValidate
      >
        <Row label="Citizen code" htmlFor={ids.code} hint="The code the citizen shows you.">
          <CodeSlots
            id={ids.code}
            value={v.subjectCode}
            invalid={codeInvalid}
            describedBy={`${ids.code}-h`}
            onChange={(subjectCode) => set({ subjectCode: normalizeCitizenCode(subjectCode) })}
          />
          <p id={`${ids.code}-h`} className={`mt-2.5 text-[13px] ${codeInvalid ? 'text-pending' : 'text-ink-2'}`}>
            {codeInvalid ? cErr : 'Six characters. Letters are capitalised for you; codes never use 0, O, 1 or I.'}
          </p>
        </Row>

        <Row label="Access type" as="fieldset" hint="What you did with the data.">
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="radiogroup"
            aria-label="Access type"
            onKeyDown={(e) => arrowPick(e, [0, 1, 2, 3] as EventTypeCode[], v.eventType, (eventType) => set({ eventType }))}
          >
            {EVENT_TYPES.map((name, i) => {
              const code = i as EventTypeCode
              const on = v.eventType === code
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => set({ eventType: code })}
                  className={`flex min-h-14 items-center justify-center rounded-md border px-3 py-2 text-center text-[14px] font-medium leading-tight transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(.65,0,.2,1)] ${
                    on ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-card text-ink hover:border-ink'
                  }`}
                >
                  {EVENT_LABELS[name]}
                </button>
              )
            })}
          </div>
        </Row>

        <Row label="Which data" as="fieldset" hint="Every kind you opened. Hashed into the receipt.">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Which data" aria-describedby={`${ids.data}-h`}>
            {DATA_CATEGORIES.map((c, i) => {
              const on = v.dataCategories.includes(c)
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  aria-invalid={categoriesInvalid && i === 0 ? true : undefined}
                  onClick={() => toggleCategory(c)}
                  className={`inline-flex h-10 items-center gap-2 rounded-pill border px-4 text-[14px] font-medium transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(.65,0,.2,1)] ${
                    on
                      ? 'border-ink bg-ink text-paper'
                      : categoriesInvalid
                        ? 'border-pending/60 bg-card text-ink hover:border-ink'
                        : 'border-line-strong bg-card text-ink hover:border-ink'
                  }`}
                >
                  <span aria-hidden="true" className={`size-1.5 rounded-full ${on ? 'bg-paper' : 'bg-line-strong'}`} />
                  {DATA_CATEGORY_LABELS[c]}
                </button>
              )
            })}
          </div>
          <p id={`${ids.data}-h`} className={`mt-2.5 text-[13px] ${categoriesInvalid ? 'text-pending' : 'text-ink-2'}`}>
            {categoriesInvalid
              ? dErr
              : v.dataCategories.length
                ? `${v.dataCategories.length} selected. The citizen sees these on the receipt.`
                : 'Tap each kind of data the officer opened.'}
          </p>
        </Row>

        <Row label="Purpose" htmlFor={ids.purpose} hint="Plain words. The citizen reads exactly this.">
          <div className="relative">
            <input
              id={ids.purpose}
              value={v.purposeText}
              maxLength={PURPOSE_MAX}
              onChange={(e) => set({ purposeText: e.target.value })}
              aria-invalid={purposeInvalid}
              aria-describedby={`${ids.purpose}-h`}
              className="h-[52px] w-full rounded-md border border-line-strong bg-card pl-4 pr-20 text-[16px] text-ink outline-none transition-colors placeholder:text-ink-3 hover:border-ink focus:border-blue aria-[invalid=true]:border-pending"
              placeholder="e.g. Debt collection"
            />
            <span
              className={`tnum pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[12px] ${v.purposeText.length >= PURPOSE_MAX ? 'text-pending' : 'text-ink-3'}`}
              aria-hidden="true"
            >
              {v.purposeText.length}/{PURPOSE_MAX}
            </span>
          </div>
          <p id={`${ids.purpose}-h`} className={`mt-2.5 text-[13px] ${purposeInvalid ? 'text-pending' : 'text-ink-2'}`}>
            {purposeInvalid ? pErr : `${v.purposeText.length} of ${PURPOSE_MAX} characters.`}
          </p>
        </Row>

        <Row label="Legal basis" as="fieldset" hint="UU PDP Art. 20(2). Pick the one that applies.">
          <div
            id={ids.basis}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
            role="radiogroup"
            aria-label="Legal basis, UU PDP Art. 20(2)"
            onKeyDown={(e) => arrowPick(e, LEGAL_BASIS_KEYS, v.legalBasisKey, (legalBasisKey) => set({ legalBasisKey }))}
          >
            {LEGAL_BASIS_KEYS.map((k) => {
              const on = v.legalBasisKey === k
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => set({ legalBasisKey: k })}
                  className={`flex min-h-[72px] flex-col items-start gap-1 rounded-md border px-3.5 py-3 text-left transition-[background-color,border-color] duration-150 ${
                    on ? 'border-ink bg-card shadow-[inset_0_0_0_1px_var(--color-ink)]' : 'border-line-strong bg-card hover:border-ink'
                  }`}
                >
                  <span className="flex items-baseline gap-1.5 text-[14px] font-medium text-ink">
                    <span className={`font-mono text-[12px] ${on ? 'text-ink' : 'text-ink-3'}`}>({k.slice(-1)})</span>
                    {LEGAL_BASES[k]}
                  </span>
                  <span className="text-[12px] leading-snug text-ink-2">{BASIS_HINT[k]}</span>
                </button>
              )
            })}
          </div>
        </Row>

        <Row label="Recorded from" as="fieldset" hint="Where it happened and which desk. No names.">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={ids.system} className="text-[12px] text-ink-2">
                System
              </label>
              <input
                id={ids.system}
                value={v.system}
                maxLength={SYSTEM_MAX}
                onChange={(e) => set({ system: e.target.value })}
                aria-describedby={`${ids.system}-h`}
                className="h-11 w-full min-w-0 rounded-md border border-line-strong bg-card px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-3 hover:border-ink focus:border-blue"
                placeholder={controllerName || 'Your registered name'}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={ids.operator} className="text-[12px] text-ink-2">
                Officer reference
              </label>
              <input
                id={ids.operator}
                value={v.operatorRef}
                maxLength={32}
                onChange={(e) => set({ operatorRef: e.target.value })}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={sourceInvalid}
                aria-describedby={`${ids.system}-h`}
                className="h-11 w-full min-w-0 rounded-md border border-line-strong bg-card px-3.5 font-mono text-[14px] text-ink outline-none transition-colors placeholder:text-ink-3 hover:border-ink focus:border-blue aria-[invalid=true]:border-pending"
                placeholder="desk-07"
              />
            </div>
          </div>
          <p id={`${ids.system}-h`} className={`mt-2.5 text-[13px] ${sourceInvalid ? 'text-pending' : 'text-ink-2'}`}>
            {sourceInvalid
              ? sErr
              : `Left empty, the system is recorded as ${controllerName ? `“${controllerName}”` : 'your registered name'}.`}
          </p>
        </Row>

        <div className="flex flex-col gap-5 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex max-w-[38ch] items-start gap-2.5 text-[14px] leading-snug text-ink-2">
            <IconLock size={15} className="mt-0.5 shrink-0" /> Only a pseudonym and a fingerprint go on chain. No names, no ID numbers.
          </p>
          <Button type="submit" variant="dark" size="lg" arrow loading={busy} disabled={busy} className="sm:min-w-[232px]">
            {busy ? 'Sealing…' : <OdoText>Seal on chain</OdoText>}
          </Button>
        </div>
      </form>

      <div className="flex min-w-0 flex-col gap-10 lg:col-span-5">
        <PhonePreview opening={preview} code={v.subjectCode} legalBasisKey={v.legalBasisKey} now={now} />
        {aside}
      </div>
    </div>
  )
}
