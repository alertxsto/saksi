'use client'

// Direction A · "Receipt Stub" — every access is a paper stub you can hold; the verdict is an official stamp.
// Borrows: Apple Wallet pass + Luma/Delta ticket notches, government rubber stamp, Paper & Vault tokens.
import type { CSSProperties, ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { initials } from '@/components/citizen/ReceiptRows'
import { IconArrow, IconCheck, IconCopy, IconDownload, IconLock, IconReceipt, IconShare, IconSpark, IconUser } from '@/components/ui/icons'
import { LogoMark } from '@/components/ui/Logo'
import { VaultSeal } from '@/components/ui/VaultSeal'
import { timeBucket } from '@/lib/format'
import type { ReceiptOpening } from '@/lib/shared/types'
import { CODE, NOW, HOME, MATCH, OPENING, VERB, VERB_TAIL, WS, buckets, clock, day, facts, sealing, who } from '../fixtures'

const v = (o: Record<string, string>) => o as CSSProperties

// ---- pieces ------------------------------------------------------------------------------------

function Check({ size = 24 }: { size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-ok-bg text-ok" style={{ width: size, height: size }} title="Matches the chain">
      <IconCheck size={Math.round(size * 0.54)} strokeWidth={2.6} aria-hidden="true" />
      <span className="sr-only">Matches the chain</span>
    </span>
  )
}

/** One receipt as a ticket stub: time on the torn-off side, who + what on the body, one status. */
function StubRow({ o, selected = false }: { o: ReceiptOpening; selected?: boolean }) {
  const today = timeBucket(o.createdAt, NOW) !== 'EARLIER'
  return (
    <li className="idn-ticket-shadow">
      <a
        href="#"
        aria-current={selected ? 'page' : undefined}
        className={`idn-stub relative flex min-h-[72px] items-stretch rounded-[16px] transition-colors ${selected ? 'bg-ink text-paper' : 'bg-card text-ink hover:bg-white'}`}
        style={v({ '--cut': '74px' })}
      >
        <span className="flex w-[74px] shrink-0 flex-col items-center justify-center py-3">
          <span className="tnum text-[17px] font-semibold tracking-[-0.02em]">{clock(o)}</span>
          <span className={`text-[12px] ${selected ? 'text-paper/75' : 'text-ink-2'}`}>{today ? 'Today' : day(o)}</span>
        </span>
        <span aria-hidden="true" className={`idn-perf-v absolute bottom-3 left-[73px] top-3 ${selected ? 'text-paper/30' : 'text-line-strong'}`} />
        <span className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-3.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-semibold leading-snug tracking-[-0.01em]">{who(o)}</span>
            <span className={`block truncate text-[14px] leading-snug ${selected ? 'text-paper/75' : 'text-ink-2'}`}>
              {VERB[o.eventType]} {o.eventType === 3 ? 'with a third party' : 'your data'} · {o.purposeText}
            </span>
          </span>
          {sealing(o) ? <span className="shrink-0 text-[13px] font-medium text-pending">Sealing…</span> : <Check />}
        </span>
      </a>
    </li>
  )
}

/** The citizen's pass: vault slab, the live verdict on top, the code on the tear-off stub. */
function CitizenPass({ compact = false }: { compact?: boolean }) {
  const notch = compact ? 84 : 176
  return (
    <div className="idn-ticket-shadow idn-rise">
      <section
        aria-label="Your receipts status"
        className="idn-ticket grain relative overflow-hidden rounded-[24px] bg-vault text-vault-ink"
        style={v({ '--notch': `${notch}px` })}
      >
        <div className="relative z-[1] flex flex-col p-5" style={{ height: notch }}>
          <div className="flex items-start justify-between">
            <div className={`${compact ? 'h-[44px] w-[44px]' : 'h-[54px] w-[54px]'} rounded-[14px] bg-vault-2 p-1.5`} aria-hidden="true">
              <VaultSeal tone="ok" grid={false} boost={1.6} />
            </div>
            <span className="flex h-7 items-center gap-1.5 rounded-pill bg-vault-2 px-2.5 text-[13px] text-vault-ink">
              <span className="idn-live h-1.5 w-1.5 rounded-full bg-ok-v" aria-hidden="true" /> Live
            </span>
          </div>
          {compact ? null : (
            <>
              <p className="mt-auto text-[21px] font-semibold leading-[1.15] tracking-[-0.02em]">All 4 receipts match the chain</p>
              <p className="mt-1 text-[14px] leading-snug text-vault-ink-2">Your phone checked them 3 s ago, not Saksi&apos;s server.</p>
            </>
          )}
        </div>
        <span aria-hidden="true" className="idn-perf absolute left-5 right-5 z-[1] text-vault-ink-2/50" style={{ top: notch - 1 }} />
        <div className="relative z-[1] flex items-center gap-4 px-5 pb-5 pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-vault-ink-2">Your code</p>
            <p className={`doto mt-1.5 tracking-[0.06em] text-vault-ink ${compact ? 'text-[22px]' : 'text-[34px]'}`}>{CODE}</p>
            {compact ? null : <p className="mt-2 text-[13px] leading-snug text-vault-ink-2">Show it to a company. Every access comes back here as a receipt.</p>}
          </div>
          <div className="shrink-0 rounded-[10px] bg-[#FBFAF7] p-1.5">
            <QRCodeSVG value={`https://saksi.app/c/${CODE}`} size={compact ? 44 : 68} bgColor="#FBFAF7" fgColor="#1E1A16" level="M" />
          </div>
        </div>
      </section>
    </div>
  )
}

/** The verdict as an official stamp, pressed onto the ticket. */
function Stamp({ size = 132 }: { size?: number }) {
  const r = 58
  return (
    <div className="idn-stamp pointer-events-none" style={{ width: size, height: size }} role="img" aria-label="Stamped: matches the chain, verified by your phone in 1.84 seconds">
      <svg viewBox="0 0 132 132" className="h-full w-full text-ok" style={{ mixBlendMode: 'multiply' }}>
        <defs>
          <path id="idn-stamp-ring" d={`M66,66 m-${r - 10},0 a${r - 10},${r - 10} 0 1,1 ${(r - 10) * 2},0 a${r - 10},${r - 10} 0 1,1 -${(r - 10) * 2},0`} />
        </defs>
        <circle cx="66" cy="66" r={r} fill="none" stroke="currentColor" strokeWidth="2.6" opacity="0.9" />
        <circle cx="66" cy="66" r={r - 18} fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.75" />
        <text className="idn-stamp-ink" fill="currentColor" fontSize="9.6" fontWeight="700" letterSpacing="1.15" fontFamily="var(--font-geist-mono)">
          <textPath href="#idn-stamp-ring">MATCHES THE CHAIN · CHECKED BY YOUR PHONE ·</textPath>
        </text>
        <path d="M51 64.5 61.5 75 81 54" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="66" y="90" textAnchor="middle" fill="currentColor" fontSize="9.5" fontWeight="600" fontFamily="var(--font-geist-mono)">
          1.84 S
        </text>
      </svg>
    </div>
  )
}

function Field({ k, children, mono = false }: { k: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-ink-2">{k}</dt>
      <dd className={`mt-0.5 truncate text-ink ${mono ? 'tnum font-mono text-[14px]' : 'text-[15px] font-medium'}`}>{children}</dd>
    </div>
  )
}

/** The receipt itself: who, the verb as big type (boarding-pass "JFK → SFO"), fields, and the tear-off proof stub. */
function Ticket({ o, wide = false }: { o: ReceiptOpening; wide?: boolean }) {
  const f = facts(o)
  const notch = wide ? 312 : 300
  return (
    <div className="relative">
      <div className="idn-ticket-shadow idn-rise">
        <article className="idn-ticket relative rounded-[24px] bg-card" style={v({ '--notch': `${notch}px` })} aria-label="Receipt">
          <div className="flex flex-col p-5" style={{ height: notch }}>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper-2 text-[15px] font-semibold">
                {initials(o.controllerName)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold leading-tight">{who(o)}</span>
                <span className="block text-[13px] text-ink-2">Opened your data · {clock(o)} WIB</span>
              </span>
            </div>
            <h1 className={`mt-6 font-semibold leading-[0.92] tracking-[-0.045em] text-ink ${wide ? 'text-[64px]' : 'text-[56px]'}`}>{VERB[o.eventType]}</h1>
            <p className="mt-1.5 text-[20px] leading-tight tracking-[-0.01em] text-ink-2">{VERB_TAIL[o.eventType]}</p>
            <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3">
              <Field k="Purpose">{f.purpose}</Field>
              <Field k="Legal basis">{f.basis}</Field>
              <Field k="Sealed">{day(o)}, {clock(o)} WIB</Field>
              <Field k="Block" mono>
                {f.block}
              </Field>
            </dl>
          </div>
          <span aria-hidden="true" className="idn-perf absolute left-5 right-5 text-line-strong" style={{ top: notch - 1 }} />
          <dl className="grid grid-cols-[1fr_auto] items-end gap-x-4 gap-y-3 px-5 pb-5 pt-4">
            <Field k="Fingerprint" mono>
              {f.fingerprint}
            </Field>
            <button type="button" aria-label="Copy fingerprint" className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-2 hover:text-ink">
              <IconCopy size={15} />
            </button>
            <Field k="Data used">{f.data}</Field>
          </dl>
        </article>
      </div>
      <div className="absolute right-3 top-[44px]">
        <Stamp size={wide ? 140 : 128} />
      </div>
    </div>
  )
}

function DarkButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="flex h-14 w-full items-center justify-between rounded-[14px] bg-ink pl-5 pr-2 text-[16px] font-medium text-paper">
      {children}
      <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-blue text-white" aria-hidden="true">
        <IconArrow size={17} />
      </span>
    </button>
  )
}

function TabBar() {
  const items: Array<[string, ReactNode, boolean]> = [
    ['Receipts', <IconReceipt key="r" size={18} />, true],
    ['Verify', <IconLock key="v" size={18} />, false],
    ['Profile', <IconUser key="p" size={18} />, false],
  ]
  return (
    <nav aria-label="Citizen" className="fixed inset-x-0 bottom-5 z-20 flex justify-center px-4">
      <ul className="flex h-[58px] w-full max-w-[320px] items-center gap-1 rounded-pill bg-ink p-1.5 shadow-[0_12px_30px_rgb(30_26_22/0.25)]">
        {items.map(([label, icon, active]) => (
          <li key={label} className="flex-1">
            <a
              href="#"
              aria-current={active ? 'page' : undefined}
              className={`flex h-[46px] items-center justify-center gap-2 rounded-pill text-[14px] font-medium ${active ? 'bg-paper text-ink' : 'text-paper/75 hover:text-paper'}`}
            >
              {icon}
              {active ? label : <span className="sr-only">{label}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Groups({ receipts, selectedId }: { receipts: ReceiptOpening[]; selectedId?: string }) {
  return (
    <div className="flex flex-col gap-6">
      {buckets(receipts).map((g) => (
        <section key={g.key} aria-labelledby={`a-${g.key}`}>
          <div className="flex items-baseline justify-between px-1 pb-2.5">
            <h2 id={`a-${g.key}`} className="text-[15px] font-semibold">
              {g.label}
            </h2>
            <span className="tnum text-[13px] text-ink-2">
              {g.items.length} {g.items.length === 1 ? 'receipt' : 'receipts'}
            </span>
          </div>
          <ul className="flex flex-col gap-2.5">
            {g.items.map((o) => (
              <StubRow key={o.eventId} o={o} selected={o.eventId === selectedId} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

// ---- screens -----------------------------------------------------------------------------------

export function AHome() {
  return (
    <div className="idn-root min-h-dvh bg-paper px-4 pb-32 pt-4 text-ink">
      <header className="flex h-12 items-center justify-between">
        <span className="flex items-center gap-2.5">
          <LogoMark size={22} />
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Receipts</h1>
        </span>
        <button type="button" aria-label="Profile" className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-ink-2">
          <IconUser size={17} />
        </button>
      </header>
      <div className="mt-4">
        <CitizenPass />
      </div>
      <div className="mt-7">
        <Groups receipts={HOME} />
      </div>
      <a href="#" className="mt-6 flex min-h-11 items-center gap-2 px-1 text-[14px] font-medium text-ink-2">
        <IconLock size={14} /> What a receipt proves
      </a>
      <TabBar />
    </div>
  )
}

function Actions() {
  return (
    <div className="flex flex-col gap-2.5">
      <DarkButton>Check on chain again</DarkButton>
      <button type="button" className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-line-strong bg-card text-[15px] font-medium text-ink">
        <IconSpark size={15} /> Explain with AI
      </button>
      <div className="mt-1 flex items-center justify-center gap-5 text-[14px] font-medium text-ink-2">
        <a href="#" className="flex min-h-11 items-center gap-1.5 hover:text-ink">
          <IconDownload size={14} /> Save
        </a>
        <a href="#" className="flex min-h-11 items-center gap-1.5 hover:text-ink">
          <IconShare size={14} /> Share proof
        </a>
        <a href="#" className="flex min-h-11 items-center hover:text-ink">
          Report a problem
        </a>
      </div>
    </div>
  )
}

function Verified() {
  return (
    <p className="flex items-center gap-2.5 text-[14px] leading-snug text-ink-2">
      <Check size={22} />
      <span>
        <strong className="font-semibold text-ok">Matches the chain.</strong> Your phone asked Sepolia directly · {MATCH.confirmations} confirmations
      </span>
    </p>
  )
}

export function ADetail() {
  return (
    <div className="idn-root min-h-dvh overflow-x-clip bg-paper px-4 pb-10 pt-4 text-ink">
      <header className="flex h-12 items-center justify-between">
        <a href="#" aria-label="Back to receipts" className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card">
          <IconArrow size={16} className="rotate-180" />
        </a>
        <span className="text-[16px] font-semibold">Receipt</span>
        <button type="button" aria-label="Share" className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card">
          <IconShare size={15} />
        </button>
      </header>
      <div className="mt-4">
        <Ticket o={OPENING} />
      </div>
      <div className="mt-5">
        <Verified />
      </div>
      <div className="mt-5">
        <Actions />
      </div>
    </div>
  )
}

export function AWorkspace() {
  const nav: Array<[string, ReactNode, boolean]> = [
    ['Receipts', <IconReceipt key="r" size={17} />, true],
    ['Verify a receipt', <IconLock key="v" size={17} />, false],
    ['Profile', <IconUser key="p" size={17} />, false],
  ]
  return (
    <div className="idn-root grid h-dvh grid-cols-[248px_440px_minmax(0,1fr)] overflow-hidden bg-paper text-ink">
      <aside className="flex flex-col border-r border-line bg-paper-2/50 px-4 py-5">
        <span className="flex items-center gap-2.5 px-2">
          <LogoMark />
          <span className="text-[19px] font-semibold tracking-[-0.04em]">saksi</span>
        </span>
        <ul className="mt-7 flex flex-col gap-1">
          {nav.map(([label, icon, active]) => (
            <li key={label}>
              <a
                href="#"
                aria-current={active ? 'page' : undefined}
                className={`flex h-10 items-center gap-3 rounded-[12px] px-3 text-[15px] font-medium ${active ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper-2 hover:text-ink'}`}
              >
                {icon}
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-auto">
          <CitizenPass compact />
        </div>
      </aside>
      <section className="flex min-h-0 flex-col border-r border-line">
        <header className="px-6 pb-4 pt-6">
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Receipts</h1>
          <p className="mt-1.5 flex items-center gap-2 text-[14px] text-ink-2">
            <Check size={18} /> All 8 sealed receipts match the chain · checked 3 s ago
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
          <Groups receipts={WS} selectedId={OPENING.eventId} />
        </div>
      </section>
      <main className="min-h-0 overflow-y-auto">
        <div className="mx-auto flex max-w-[540px] flex-col gap-5 px-8 py-10">
          <Ticket o={OPENING} wide />
          <Verified />
          <Actions />
        </div>
      </main>
    </div>
  )
}
