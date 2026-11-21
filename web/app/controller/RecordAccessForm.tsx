'use client'

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { CarbonTicket, type CarbonStatus } from '@/components/controller/AgencyKit'
import { IconLock } from '@/components/controller/agency-icons'
import { Button } from '@/components/ui/Button'
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

/**
 * One-click scenarios: they fill every citizen-facing field except the citizen code. The values go through the
 * same validation and the same submit as typed ones.
 */
type Preset = { id: string; title: string; note?: string; values: Omit<AccessFormValues, 'subjectCode'> }
export const SCENARIOS: Preset[] = [
  {
    id: 'kur',
    title: 'Bank checks NIK for a KUR loan',
    values: { eventType: 0, dataCategories: ['identity'], legalBasisKey: 'PDP-20-2-b', purposeText: 'Cek NIK untuk pengajuan pinjaman KUR', system: 'Core banking · KUR', operatorRef: 'teller-03' },
  },
  {
    id: 'pinjol',
    title: 'Loan app checks NIK at 02:13',
    note: 'The citizen will tap “Not me”',
    values: { eventType: 0, dataCategories: ['identity'], legalBasisKey: 'PDP-20-2-a', purposeText: 'Verifikasi pinjaman online', system: 'Loan app API', operatorRef: 'api-0213' },
  },
  {
    id: 'simrs',
    title: 'Hospital opens a medical record',
    values: { eventType: 0, dataCategories: ['health'], legalBasisKey: 'PDP-20-2-e', purposeText: 'Buka rekam medis untuk pemeriksaan pasien', system: 'SIMRS', operatorRef: 'desk-07' },
  },
  {
    id: 'share',
    title: 'Agency shares data with a third party',
    values: { eventType: 3, dataCategories: ['identity', 'address'], legalBasisKey: 'PDP-20-2-f', purposeText: 'Berbagi data ke mitra penagihan', system: '', operatorRef: 'officer' },
  },
]

function presetMatches(p: Preset, v: AccessFormValues) {
  const x = p.values
  return (
    x.eventType === v.eventType &&
    x.legalBasisKey === v.legalBasisKey &&
    x.purposeText === v.purposeText &&
    x.system === v.system &&
    x.operatorRef === v.operatorRef &&
    x.dataCategories.join() === v.dataCategories.join()
  )
}

const VERB_SHORT = ['Read', 'Update', 'Export', 'Share'] as const

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

/** One inset group: a title + one line, then the controls. */
function Group({ title, hint, children, labelledBy }: { title: string; hint?: ReactNode; children: ReactNode; labelledBy?: string }) {
  const id = useId()
  return (
    <section aria-labelledby={labelledBy ?? id} className="ag-group">
      <div className="px-5 pb-3 pt-4">
        <h2 id={labelledBy ? undefined : id} className="text-[15px] font-semibold text-ink">
          {title}
        </h2>
        {hint ? <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{hint}</p> : null}
      </div>
      <div className="flex flex-col gap-6 px-5 pb-5 pt-2">{children}</div>
    </section>
  )
}

function FieldLabel({ children, htmlFor, id }: { children: ReactNode; htmlFor?: string; id?: string }) {
  return htmlFor ? (
    <label htmlFor={htmlFor} className="mb-2 block text-[14px] font-medium text-ink">
      {children}
    </label>
  ) : (
    <p id={id} className="mb-2 text-[14px] font-medium text-ink">
      {children}
    </p>
  )
}

function Help({ id, bad, children }: { id?: string; bad?: boolean; children: ReactNode }) {
  return (
    <p id={id} className={`mt-2 text-[13px] leading-snug ${bad ? 'text-pending' : 'text-ink-2'}`}>
      {children}
    </p>
  )
}

/** Six code slots over one real input (paste and autofill work; the input carries label + errors). */
function CodeSlots({ id, value, invalid, describedBy, onChange }: { id: string; value: string; invalid: boolean; describedBy: string; onChange: (v: string) => void }) {
  const [focus, setFocus] = useState(false)
  const active = Math.min(value.length, 5)
  return (
    <div className="relative max-w-[400px]">
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
        className="absolute inset-0 z-10 h-full w-full cursor-text rounded-[12px] opacity-0"
      />
      <div aria-hidden="true" className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }, (_, i) => {
          const ch = value[i] ?? ''
          const bad = ch && !CODE_CHAR.test(ch)
          const on = focus && ((i === active && value.length < 6) || (value.length === 6 && i === 5))
          return (
            <span
              key={i}
              className={`relative flex h-14 items-center justify-center rounded-[12px] border text-[26px] transition-[border-color,background-color] duration-150 ${
                bad
                  ? 'border-pending bg-pending-bg text-pending'
                  : on
                    ? 'border-blue bg-card text-ink'
                    : ch
                      ? 'border-line-strong bg-card text-ink'
                      : invalid
                        ? 'border-pending/60 bg-paper'
                        : 'border-line bg-paper'
              }`}
            >
              {ch ? <span className="doto">{ch}</span> : null}
              {on && value.length < 6 ? <span className="ctl-caret absolute h-7 w-[2px] rounded-full bg-blue" /> : null}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Record-access form (inset groups) + the live carbon copy of the citizen's receipt. Field state lives here; the
 * parent only gets validated values through onSeal. `aside` renders under the ticket (the seal stepper).
 */
export function RecordAccessForm({
  controllerName,
  initial,
  showErrors = false,
  busy = false,
  ticketStatus = 'draft',
  sealedAt,
  aside,
  onSeal,
}: {
  controllerName: string
  initial?: Partial<AccessFormValues>
  /** Show validation messages before the first submit (dev gallery). */
  showErrors?: boolean
  busy?: boolean
  /** Status the carbon copy shows (mirror the transaction). */
  ticketStatus?: CarbonStatus
  sealedAt?: number | string | null
  /** Rendered in the right column under the ticket. */
  aside?: ReactNode
  onSeal: (values: AccessFormValues) => void
}) {
  const [v, setV] = useState<AccessFormValues>({ ...DEFAULT_ACCESS_VALUES, ...initial })
  const [touched, setTouched] = useState(showErrors)
  const now = useNow()
  const ids = { code: useId(), purpose: useId(), type: useId(), data: useId(), basis: useId(), system: useId(), operator: useId() }
  const formRef = useRef<HTMLFormElement>(null)

  const cErr = codeError(v.subjectCode)
  const pErr = purposeError(v.purposeText)
  const dErr = categoriesError(v.dataCategories)
  const sErr = sourceError(v.system, v.operatorRef)
  const valid = !cErr && !pErr && !dErr && !sErr
  const set = (patch: Partial<AccessFormValues>) => setV((cur) => ({ ...cur, ...patch }))

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
  // The button names who signs; the "(fiktif)" suffix stays on the ticket and in the sidebar.
  const signer = controllerName.replace(/\s*\([^)]*\)\s*$/, '') || 'your agency'

  return (
    <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-w-0 flex-col gap-5">
        <section aria-labelledby="scenarios-h" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="scenarios-h" className="text-[15px] font-semibold text-ink">
              Start from a scenario
            </h2>
            <span className="hidden text-[13px] text-ink-3 sm:inline">Fills everything except the citizen</span>
          </div>
          <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0">
            {SCENARIOS.map((p) => {
              const on = presetMatches(p, v)
              const meta = [VERB_SHORT[p.values.eventType], p.values.dataCategories.map((c) => DATA_CATEGORY_LABELS[c]).join(', '), LEGAL_BASES[p.values.legalBasisKey]].join(' · ')
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => set(p.values)}
                  className={`ag-chip flex w-[236px] shrink-0 snap-start flex-col items-start gap-1 rounded-[14px] px-4 py-3 text-left sm:w-auto ${
                    on ? 'bg-ink text-paper' : 'bg-card text-ink shadow-[0_0_0_1px_var(--color-line)] hover:shadow-[0_0_0_1px_var(--color-ink-2)]'
                  } disabled:opacity-60`}
                >
                  <span className="text-[15px] font-medium leading-snug">{p.title}</span>
                  <span className={`text-[13px] leading-snug ${on ? 'text-paper/70' : 'text-ink-2'}`}>{meta}</span>
                  {p.note ? <span className={`text-[12px] ${on ? 'text-paper/70' : 'text-pending'}`}>{p.note}</span> : null}
                </button>
              )
            })}
          </div>
        </section>

        <form
          ref={formRef}
          className="flex min-w-0 flex-col gap-5"
          aria-label="Simulate one lookup"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
          noValidate
        >
          <Group title="Citizen" hint="In production the agency already has the NIK it looked up. Saksi turns it into a per-agency pseudonym, and no NIK goes on chain.">
            <div>
              <FieldLabel htmlFor={ids.code}>Citizen NIK (in this prototype: the citizen’s code)</FieldLabel>
              <CodeSlots
                id={ids.code}
                value={v.subjectCode}
                invalid={codeInvalid}
                describedBy={`${ids.code}-h`}
                onChange={(subjectCode) => set({ subjectCode: normalizeCitizenCode(subjectCode) })}
              />
              <Help id={`${ids.code}-h`} bad={codeInvalid}>
                {codeInvalid ? cErr : 'Six characters from the citizen’s phone. Codes never use 0, O, 1 or I.'}
              </Help>
            </div>
          </Group>

          <Group title="What the officer did">
            <div role="group" aria-labelledby={ids.type}>
              <FieldLabel id={ids.type}>Access type</FieldLabel>
              <div
                className="grid grid-cols-2 gap-1 rounded-[12px] bg-paper-2/80 p-1 sm:grid-cols-4"
                role="radiogroup"
                aria-labelledby={ids.type}
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
                      className={`ag-chip flex min-h-11 items-center justify-center rounded-[9px] px-2 text-center text-[14px] font-medium leading-tight ${
                        on ? 'bg-card text-ink shadow-[0_1px_2px_rgb(30_26_22/0.12),0_0_0_1px_var(--color-line)]' : 'text-ink-2 hover:text-ink'
                      }`}
                    >
                      {VERB_SHORT[i]}
                      <span className="sr-only"> · {EVENT_LABELS[name]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <FieldLabel id={`${ids.data}-l`}>Which data</FieldLabel>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${ids.data}-l`} aria-describedby={`${ids.data}-h`}>
                {DATA_CATEGORIES.map((c, i) => {
                  const on = v.dataCategories.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      aria-invalid={categoriesInvalid && i === 0 ? true : undefined}
                      onClick={() => toggleCategory(c)}
                      className={`ag-chip inline-flex h-10 items-center gap-1.5 rounded-pill border px-3.5 text-[14px] font-medium ${
                        on ? 'border-ink bg-ink text-paper' : categoriesInvalid ? 'border-pending/60 bg-card text-ink hover:border-ink' : 'border-line-strong bg-card text-ink hover:border-ink'
                      }`}
                    >
                      {on ? (
                        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                          <path d="M3.5 8.5 6.5 11.5 12.5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                      {DATA_CATEGORY_LABELS[c]}
                    </button>
                  )
                })}
              </div>
              <Help id={`${ids.data}-h`} bad={categoriesInvalid}>
                {categoriesInvalid ? dErr : v.dataCategories.length ? `${v.dataCategories.length} selected. The citizen sees these on the receipt.` : 'Every kind of data the officer opened.'}
              </Help>
            </div>
          </Group>

          <Group title="Why" hint="UU PDP Pasal 20(2): every access needs a stated purpose and a legal basis.">
            <div>
              <FieldLabel htmlFor={ids.purpose}>Purpose</FieldLabel>
              <div className="relative">
                <input
                  id={ids.purpose}
                  value={v.purposeText}
                  maxLength={PURPOSE_MAX}
                  onChange={(e) => set({ purposeText: e.target.value })}
                  aria-invalid={purposeInvalid}
                  aria-describedby={`${ids.purpose}-h`}
                  className="ag-input pr-16"
                  placeholder="e.g. Verifikasi pinjaman online"
                />
                <span aria-hidden="true" className={`tnum pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] ${v.purposeText.length >= PURPOSE_MAX ? 'text-pending' : 'text-ink-3'}`}>
                  {v.purposeText.length}/{PURPOSE_MAX}
                </span>
              </div>
              <Help id={`${ids.purpose}-h`} bad={purposeInvalid}>
                {purposeInvalid ? pErr : 'Plain words. The citizen reads exactly this.'}
              </Help>
            </div>

            <div role="group" aria-labelledby={ids.basis}>
              <FieldLabel id={ids.basis}>Legal basis</FieldLabel>
              <div
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Legal basis, UU PDP Pasal 20(2)"
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
                      className={`ag-chip flex items-start gap-3 rounded-[12px] border px-3.5 py-3 text-left ${
                        on ? 'border-ink bg-card shadow-[inset_0_0_0_1px_var(--color-ink)]' : 'border-line-strong bg-card hover:border-ink-2'
                      }`}
                    >
                      <span aria-hidden="true" className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border ${on ? 'border-ink' : 'border-line-strong'}`}>
                        {on ? <span className="size-2.5 rounded-full bg-ink" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium text-ink">
                          {LEGAL_BASES[k]} <span className="font-normal text-ink-3">({k.slice(-1)})</span>
                        </span>
                        <span className="block text-[13px] leading-snug text-ink-2">{BASIS_HINT[k]}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </Group>

          <Group title="Recorded from" hint="Which system and which desk. Never a person’s name.">
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <div className="min-w-0">
                <FieldLabel htmlFor={ids.system}>System</FieldLabel>
                <input
                  id={ids.system}
                  value={v.system}
                  maxLength={SYSTEM_MAX}
                  onChange={(e) => set({ system: e.target.value })}
                  aria-describedby={`${ids.system}-h`}
                  className="ag-input"
                  placeholder={controllerName || 'Your registered name'}
                />
              </div>
              <div className="min-w-0">
                <FieldLabel htmlFor={ids.operator}>Officer reference</FieldLabel>
                <input
                  id={ids.operator}
                  value={v.operatorRef}
                  maxLength={32}
                  onChange={(e) => set({ operatorRef: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={sourceInvalid}
                  aria-describedby={`${ids.system}-h`}
                  className="ag-input font-mono text-[15px]"
                  placeholder="desk-07"
                />
              </div>
            </div>
            <Help id={`${ids.system}-h`} bad={sourceInvalid}>
              {sourceInvalid ? sErr : `Left empty, the system is recorded as ${controllerName ? `“${controllerName}”` : 'your registered name'}.`}
            </Help>
          </Group>

          <div className="ag-sticky-cta flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:pt-1">
            <p className="hidden max-w-[40ch] items-start gap-2 text-[13px] leading-snug text-ink-2 lg:flex">
              <IconLock size={14} className="mt-0.5 shrink-0" /> Only a pseudonym and a fingerprint reach the public ledger. No NIK, no names.
            </p>
            <Button type="submit" variant="dark" size="lg" arrow loading={busy} disabled={busy} full className="lg:w-auto lg:min-w-[340px]">
              {busy ? 'Sealing…' : `Sign as ${signer} and seal`}
            </Button>
          </div>
        </form>
      </div>

      <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-8 lg:self-start">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink">What the citizen receives</h2>
          <span className="text-[13px] text-ink-3">Your carbon copy</span>
        </div>
        <CarbonTicket
          status={ticketStatus}
          sealedAt={sealedAt}
          data={{
            controllerName,
            code: v.subjectCode,
            eventType: v.eventType,
            purposeText: v.purposeText.trim(),
            legalBasisKey: v.legalBasisKey,
            dataCategories: v.dataCategories,
            system: v.system.trim(),
            operatorRef: v.operatorRef.trim(),
            at: now,
          }}
        />
        {aside}
      </div>
    </div>
  )
}
