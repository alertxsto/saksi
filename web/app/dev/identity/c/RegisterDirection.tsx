'use client'

// Direction C · "Public Register" — Saksi as civic infrastructure: crisp register rows with serial numbers,
// Saksi blue promoted from accent to identity, and the public chain drawn as a strip of real blocks.
// Borrows: Monzo / Revolut / Family (saturated identity card), Mercury (precise tables, quiet chrome),
// Copilot Money (data drawn into the hero), Google "Security & sign-in" (activity as plain rows).
import type { CSSProperties, ReactNode } from 'react'
import { initials } from '@/components/citizen/ReceiptRows'
import { IconAlert, IconArrow, IconCheck, IconCopy, IconDownload, IconLock, IconQr, IconReceipt, IconShare, IconShield, IconSpark, IconUser } from '@/components/ui/icons'
import { LogoMark } from '@/components/ui/Logo'
import type { ReceiptOpening } from '@/lib/shared/types'
import { CODE, HOME, MATCH, OPENING, WS, buckets, clock, day, facts, sealing, serial, who } from '../fixtures'
import { timeBucket } from '@/lib/format'
import { NOW } from '../fixtures'

// Register palette: page #F7F6F2 · card #FFFFFF · ink #1E1A16 · ink-2 #5F5A52 · line #E4E1DA
// blue #2A2AE8 (identity) · blue-soft #ECECFE · ok #157F3D · pending #A85A00 · bad #C8281E (tamper only)

const VERBS = ['read your data', 'updated your data', 'exported your data', 'shared your data'] as const

/**
 * The public chain as a strip of blocks. Filled blocks hold one of your receipts; `target` is the block the
 * phone just checked (pops green). Not decoration: every square is a block height on Sepolia.
 */
function ChainStrip({ n = 16, filled, target, tone }: { n?: number; filled: number[]; target?: number; tone: 'blue' | 'light' }) {
  return (
    <div className="flex items-end gap-[5px]" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const isT = i === target
        const on = filled.includes(i)
        const base =
          tone === 'blue'
            ? on
              ? 'bg-white'
              : 'border border-white/30'
            : isT
              ? 'bg-ok text-white'
              : on
                ? 'bg-blue'
                : 'border border-[#D6D3CC] bg-[#F7F6F2]'
        return (
          <span
            key={i}
            className={`idn-block flex flex-1 items-center justify-center rounded-[6px] ${base} ${isT ? 'idn-pop h-8' : 'h-6'}`}
            style={{ animationDelay: `${isT ? 900 : 120 + i * 35}ms` } as CSSProperties}
          >
            {isT ? <IconCheck size={14} strokeWidth={3} /> : null}
          </span>
        )
      })}
    </div>
  )
}

function Status({ o }: { o: ReceiptOpening }) {
  if (sealing(o)) return <span className="text-[13px] font-medium text-pending">Sealing…</span>
  return (
    <span className="flex items-center gap-1 text-[13px] font-medium text-ok">
      <IconCheck size={13} strokeWidth={2.8} aria-hidden="true" /> Matches
    </span>
  )
}

function Avatar({ o, size = 44, onBlue = false }: { o: ReceiptOpening; size?: number; onBlue?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-[12px] font-semibold ${onBlue ? 'bg-white/15 text-white' : 'bg-[#ECECFE] text-blue'}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(o.controllerName)}
    </span>
  )
}

function RegisterRow({ o, last }: { o: ReceiptOpening; last: boolean }) {
  return (
    <li>
      <a href="#" className="flex min-h-[70px] items-center gap-3 pl-4 hover:bg-[#FAFAF8]">
        <Avatar o={o} />
        <span className={`flex min-w-0 flex-1 items-center gap-3 self-stretch py-3 pr-4 ${last ? '' : 'border-b border-[#ECEAE4]'}`}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-medium leading-snug text-[#1E1A16]">{who(o)}</span>
            <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[14px] leading-snug text-[#5F5A52]">
              <span className="shrink-0 font-mono text-[13px] text-[#1E1A16]">{serial(o)}</span>
              <span className="truncate">
                {['Read', 'Updated', 'Exported', 'Shared'][o.eventType]} · {o.purposeText}
              </span>
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="tnum text-[14px] text-[#1E1A16]">{timeBucket(o.createdAt, NOW) === 'EARLIER' ? day(o) : clock(o)}</span>
            <Status o={o} />
          </span>
        </span>
      </a>
    </li>
  )
}

function Register({ receipts }: { receipts: ReceiptOpening[] }) {
  return (
    <div className="flex flex-col gap-6">
      {buckets(receipts).map((g) => (
        <section key={g.key} aria-labelledby={`c-${g.key}`}>
          <div className="flex items-baseline justify-between px-1 pb-2">
            <h2 id={`c-${g.key}`} className="text-[15px] font-semibold text-[#1E1A16]">
              {g.label}
            </h2>
            <span className="tnum text-[13px] text-[#5F5A52]">{g.items.length}</span>
          </div>
          <ul className="overflow-hidden rounded-[18px] border border-[#E4E1DA] bg-white">
            {g.items.map((o, i) => (
              <RegisterRow key={o.eventId} o={o} last={i === g.items.length - 1} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** Identity card: Saksi blue, the code in Doto, the verdict as one sentence, your receipts on the chain strip. */
function IdentityCard({ compact = false, matched = 4 }: { compact?: boolean; matched?: number }) {
  return (
    <section aria-label="Your receipts status" className="idn-rise relative overflow-hidden rounded-[24px] bg-blue p-5 text-white">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <LogoMark tone="vault" size={22} />
          <span className="text-[17px] font-semibold tracking-[-0.04em]">saksi</span>
        </span>
        <span className="doto text-[22px] tracking-[0.08em]">{CODE}</span>
      </div>
      <p className={`mt-6 font-semibold leading-[1.04] tracking-[-0.035em] ${compact ? 'text-[26px]' : 'text-[32px]'}`}>Your data is witnessed.</p>
      <p className="mt-2 max-w-[34ch] text-[15px] leading-snug text-white/85">
        {matched} of {matched} sealed receipts match the public chain. Checked by your phone 3 s ago.
      </p>
      <div className="mt-5">
        <ChainStrip tone="blue" filled={[2, 6, 9, 13, 15]} />
        <div className="mt-2 flex justify-between font-mono text-[12px] text-white/80">
          <span>#7,122,980</span>
          <span>#{(MATCH.blockNumber + 214).toLocaleString('en-US')} · now</span>
        </div>
      </div>
    </section>
  )
}

function QuickActions() {
  const items: Array<[string, ReactNode]> = [
    ['Verify', <IconShield key="v" size={20} />],
    ['My code', <IconQr key="q" size={20} />],
    ['Rights', <IconLock key="r" size={20} />],
    ['Report', <IconAlert key="p" size={20} />],
  ]
  return (
    <ul className="grid grid-cols-4 gap-2">
      {items.map(([label, icon]) => (
        <li key={label}>
          <a href="#" className="flex flex-col items-center gap-1.5 text-[13px] font-medium text-[#1E1A16]">
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-[#E4E1DA] bg-white text-blue">{icon}</span>
            {label}
          </a>
        </li>
      ))}
    </ul>
  )
}

function TabBar() {
  const items: Array<[string, ReactNode, boolean]> = [
    ['Receipts', <IconReceipt key="r" size={21} />, true],
    ['Verify', <IconShield key="v" size={21} />, false],
    ['Profile', <IconUser key="p" size={21} />, false],
  ]
  return (
    <nav aria-label="Citizen" className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E4E1DA] bg-white/95 backdrop-blur-md">
      <ul className="mx-auto flex h-[68px] max-w-[430px] items-start pt-2">
        {items.map(([label, icon, active]) => (
          <li key={label} className="flex-1">
            <a href="#" aria-current={active ? 'page' : undefined} className={`flex flex-col items-center gap-1 text-[12px] font-medium ${active ? 'text-blue' : 'text-[#5F5A52]'}`}>
              {icon}
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ---- detail pieces -----------------------------------------------------------------------------

function BlueBand({ o, onPage = true }: { o: ReceiptOpening; onPage?: boolean }) {
  return (
    <div className={`bg-blue px-4 pb-7 text-white ${onPage ? 'rounded-b-[28px] pt-4' : 'rounded-[24px] pt-5'}`}>
      <div className="flex h-11 items-center justify-between">
        <a href="#" aria-label="Back to receipts" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
          <IconArrow size={16} className="rotate-180" />
        </a>
        <span className="font-mono text-[14px] font-medium tracking-[0.04em]">{serial(o)}</span>
        <button type="button" aria-label="Share" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
          <IconShare size={15} />
        </button>
      </div>
      <div className="mt-5 flex items-start gap-3.5">
        <Avatar o={o} size={52} onBlue />
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-[1.12] tracking-[-0.025em]">
            {who(o)} {VERBS[o.eventType]}
            {o.eventType === 3 ? ' with a third party' : ''}
          </h1>
          <p className="mt-1.5 text-[15px] text-white/85">
            Today, {clock(o)} WIB · {o.purposeText}
          </p>
        </div>
      </div>
      <span className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-pill bg-white px-3.5 text-[14px] font-semibold text-ok">
        <IconCheck size={14} strokeWidth={2.8} aria-hidden="true" /> Matches the chain
      </span>
    </div>
  )
}

/** The MATCH moment: phone → chain, the receipt's block lights green on the strip. */
function ChainCheck() {
  return (
    <section aria-label="Chain check" className="idn-rise rounded-[22px] border border-[#E4E1DA] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[17px] font-semibold tracking-[-0.01em] text-[#1E1A16]">Your phone checked the chain</p>
          <p className="mt-0.5 text-[14px] text-[#5F5A52]">Every field matches what was sealed.</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="doto block text-[34px] text-blue">1.84</span>
          <span className="text-[12px] text-[#5F5A52]">seconds</span>
        </p>
      </div>
      <div className="relative mt-5">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-[#1E1A16]">
          <span className="flex h-6 items-center rounded-pill bg-[#ECECFE] px-2.5 text-blue">This receipt</span>
          <svg width="90" height="14" viewBox="0 0 90 14" aria-hidden="true" className="text-ok">
            <path d="M2 7h82m0 0-5-5m5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="idn-draw" style={{ '--len': 100, animationDelay: '500ms' } as CSSProperties} />
          </svg>
          <span className="tnum font-mono text-[13px]">#{MATCH.blockNumber.toLocaleString('en-US')}</span>
        </div>
        <ChainStrip tone="light" n={12} filled={[1, 4, 10]} target={8} />
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-[#ECEAE4] pt-4">
        <div>
          <dt className="text-[12px] text-[#5F5A52]">Confirmations</dt>
          <dd className="tnum mt-0.5 text-[15px] font-semibold">{MATCH.confirmations}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-[#5F5A52]">Checked by</dt>
          <dd className="mt-0.5 text-[15px] font-semibold">Your phone</dd>
        </div>
        <div>
          <dt className="text-[12px] text-[#5F5A52]">Node</dt>
          <dd className="mt-0.5 truncate text-[15px] font-semibold">{MATCH.rpc}</dd>
        </div>
      </dl>
    </section>
  )
}

/** Register-style key/value table: labels in a fixed left column, values left-aligned (forms, not lists). */
function RegisterTable({ o }: { o: ReceiptOpening }) {
  const f = facts(o)
  const rows: Array<[string, ReactNode]> = [
    ['Action', f.action],
    ['Purpose', f.purpose],
    ['Legal basis', f.basis],
    ['Data used', f.data],
    ['Sealed', f.sealed],
    ['Block', <span key="b" className="tnum font-mono text-[14px]">{f.block}</span>],
    [
      'Fingerprint',
      <span key="f" className="inline-flex items-center gap-2 font-mono text-[14px]">
        {f.fingerprint} <IconCopy size={13} className="text-blue" />
      </span>,
    ],
  ]
  return (
    <dl className="overflow-hidden rounded-[18px] border border-[#E4E1DA] bg-white">
      {rows.map(([k, val], i) => (
        <div key={k} className={`grid min-h-12 grid-cols-[112px_minmax(0,1fr)] items-center gap-3 px-4 py-2.5 ${i ? 'border-t border-[#ECEAE4]' : ''}`}>
          <dt className="text-[14px] text-[#5F5A52]">{k}</dt>
          <dd className="min-w-0 truncate text-[15px] text-[#1E1A16]">{val}</dd>
        </div>
      ))}
    </dl>
  )
}

function Actions() {
  return (
    <div className="flex flex-col gap-2.5">
      <button type="button" className="flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-blue text-[16px] font-semibold text-white">
        <IconShield size={17} /> Check on chain again
      </button>
      <button type="button" className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-[#D6D3CC] bg-white text-[15px] font-medium text-[#1E1A16]">
        <IconSpark size={15} /> Explain with AI
      </button>
      <div className="mt-1 flex items-center justify-center gap-5 text-[14px] font-medium text-[#5F5A52]">
        <a href="#" className="flex min-h-11 items-center gap-1.5 hover:text-blue">
          <IconDownload size={14} /> Save
        </a>
        <a href="#" className="flex min-h-11 items-center gap-1.5 hover:text-blue">
          <IconShare size={14} /> Share proof
        </a>
        <a href="#" className="flex min-h-11 items-center hover:text-blue">
          Report a problem
        </a>
      </div>
    </div>
  )
}

// ---- screens -----------------------------------------------------------------------------------

export function CHome() {
  return (
    <div className="idn-root min-h-dvh bg-[#F7F6F2] px-4 pb-28 pt-4 text-[#1E1A16]">
      <header className="flex h-12 items-center justify-between">
        <h1 className="text-[30px] font-semibold tracking-[-0.035em]">Receipts</h1>
        <button type="button" aria-label="Profile" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECECFE] text-[14px] font-semibold text-blue">
          K7
        </button>
      </header>
      <div className="mt-4">
        <IdentityCard />
      </div>
      <div className="mt-5">
        <QuickActions />
      </div>
      <div className="mt-7">
        <Register receipts={HOME} />
      </div>
      <TabBar />
    </div>
  )
}

export function CDetail() {
  return (
    <div className="idn-root min-h-dvh bg-[#F7F6F2] pb-10 text-[#1E1A16]">
      <BlueBand o={OPENING} />
      <div className="flex flex-col gap-5 px-4 pt-5">
        <ChainCheck />
        <RegisterTable o={OPENING} />
        <Actions />
      </div>
    </div>
  )
}

export function CWorkspace() {
  const nav: Array<[string, ReactNode, boolean]> = [
    ['Receipts', <IconReceipt key="r" size={17} />, true],
    ['Verify a receipt', <IconShield key="v" size={17} />, false],
    ['Profile', <IconUser key="p" size={17} />, false],
  ]
  const filters = [
    ['All', WS.length],
    ['Read', WS.filter((r) => r.eventType === 0).length],
    ['Exported', WS.filter((r) => r.eventType === 2).length],
    ['Shared', WS.filter((r) => r.eventType === 3).length],
  ] as const
  return (
    <div className="idn-root grid h-dvh grid-cols-[232px_minmax(0,1fr)_440px] overflow-hidden bg-[#F7F6F2] text-[#1E1A16]">
      <aside className="flex flex-col border-r border-[#E4E1DA] bg-white px-4 py-5">
        <span className="flex items-center gap-2.5 px-2">
          <LogoMark />
          <span className="text-[19px] font-semibold tracking-[-0.04em]">saksi</span>
        </span>
        <ul className="mt-7 flex flex-col gap-1">
          {nav.map(([label, icon, active]) => (
            <li key={label}>
              <a href="#" aria-current={active ? 'page' : undefined} className={`flex h-10 items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium ${active ? 'bg-[#ECECFE] text-blue' : 'text-[#5F5A52] hover:bg-[#F7F6F2] hover:text-[#1E1A16]'}`}>
                {icon}
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-auto rounded-[16px] bg-blue p-4 text-white">
          <p className="text-[13px] text-white/85">Your code</p>
          <p className="doto mt-2 text-[26px] tracking-[0.08em]">{CODE}</p>
          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium">
            <IconCopy size={13} /> Copy code
          </p>
        </div>
      </aside>
      <section className="min-h-0 overflow-y-auto px-8 py-7">
        <header className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.035em]">Receipts</h1>
            <p className="mt-1 text-[15px] text-[#5F5A52]">Every time a company opened your data, sealed on the public chain.</p>
          </div>
        </header>
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-8 rounded-[24px] bg-blue px-6 py-5 text-white">
          <div>
            <p className="text-[24px] font-semibold leading-tight tracking-[-0.03em]">Your data is witnessed.</p>
            <p className="mt-1 text-[14px] text-white/85">8 of 8 sealed receipts match the chain · checked by your phone 3 s ago</p>
          </div>
          <div>
            <ChainStrip tone="blue" n={20} filled={[1, 3, 6, 8, 11, 14, 17, 19]} />
            <div className="mt-2 flex justify-between font-mono text-[12px] text-white/80">
              <span>#7,121,900</span>
              <span>now</span>
            </div>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2">
          {filters.map(([label, n], i) => (
            <button key={label} type="button" className={`flex h-9 items-center gap-1.5 rounded-pill px-3.5 text-[14px] font-medium ${i === 0 ? 'bg-[#1E1A16] text-white' : 'border border-[#E4E1DA] bg-white text-[#1E1A16]'}`}>
              {label} <span className={i === 0 ? 'text-white/75' : 'text-[#5F5A52]'}>{n}</span>
            </button>
          ))}
        </div>
        <table className="mt-4 w-full overflow-hidden rounded-[18px] border border-[#E4E1DA] bg-white text-left">
          <thead>
            <tr className="text-[13px] text-[#5F5A52]">
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="py-3 font-medium">Serial</th>
              <th className="py-3 font-medium">Purpose</th>
              <th className="py-3 font-medium">Sealed</th>
              <th className="py-3 pr-4 text-right font-medium">Chain check</th>
            </tr>
          </thead>
          <tbody>
            {WS.map((o) => {
              const sel = o.eventId === OPENING.eventId
              return (
                <tr key={o.eventId} aria-selected={sel} className={`border-t border-[#ECEAE4] text-[15px] ${sel ? 'bg-[#ECECFE]/60' : 'hover:bg-[#FAFAF8]'}`}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-3">
                      <Avatar o={o} size={36} />
                      <span className="min-w-0">
                        <span className="block font-medium">{who(o)}</span>
                        <span className="block text-[13px] text-[#5F5A52]">{VERBS[o.eventType]}</span>
                      </span>
                    </span>
                  </td>
                  <td className="font-mono text-[13px]">{serial(o)}</td>
                  <td className="max-w-[180px] truncate text-[#5F5A52]">{o.purposeText}</td>
                  <td className="tnum text-[14px] text-[#5F5A52]">
                    {day(o)}, {clock(o)}
                  </td>
                  <td className="pr-4 text-right">
                    <span className="inline-flex justify-end">
                      <Status o={o} />
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
      <aside className="min-h-0 overflow-y-auto border-l border-[#E4E1DA] bg-[#F7F6F2] p-5">
        <div className="flex flex-col gap-4">
          <BlueBand o={OPENING} onPage={false} />
          <ChainCheck />
          <RegisterTable o={OPENING} />
          <Actions />
        </div>
      </aside>
    </div>
  )
}
