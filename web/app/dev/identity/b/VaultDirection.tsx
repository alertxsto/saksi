'use client'

// Direction B · "Night Vault" — the whole citizen app lives inside the vault. One glowing seal answers
// "is my data OK?" before any text. Borrows: Opal (gem + score hero, gauge pills, floating glass tab bar),
// Phantom / Family dark wallets (light primary button on dark, grouped dark lists), Revolut dark cards.
import type { ReactNode } from 'react'
import { initials } from '@/components/citizen/ReceiptRows'
import { VerdictSeal } from '@/components/citizen/VerdictSeal'
import { IconArrow, IconCheck, IconClock, IconCopy, IconDownload, IconLock, IconReceipt, IconShare, IconShield, IconSpark, IconUser, IconX } from '@/components/ui/icons'
import { LogoMark } from '@/components/ui/Logo'
import type { ReceiptOpening } from '@/lib/shared/types'
import { CODE, HOME, MATCH, OPENING, WS, ago, buckets, clock, facts, sealing, who } from '../fixtures'

// Night Vault palette (deeper than the brand vault so the vault slab can still sit on top as a surface).
// bg #12110F · surface #1C1A17 · raised #262320 · line #2E2B26 · ink #EDE9E1 · ink-2 #A39B8F · ice #9BD9E0
// ok #5BCB8A · pending #F2A33A · bad #FF5A4D (tamper only)

function Ok({ size = 26 }: { size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-[#5BCB8A]/15 text-[#5BCB8A]" style={{ width: size, height: size }} title="Matches the chain">
      <IconCheck size={Math.round(size * 0.52)} strokeWidth={2.6} aria-hidden="true" />
      <span className="sr-only">Matches the chain</span>
    </span>
  )
}

function Row({ o, selected = false, last = false }: { o: ReceiptOpening; selected?: boolean; last?: boolean }) {
  return (
    <li>
      <a
        href="#"
        aria-current={selected ? 'page' : undefined}
        className={`flex min-h-[68px] items-center gap-3 pl-4 transition-colors ${selected ? 'bg-[#262320]' : 'hover:bg-[#211F1B]'}`}
      >
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#262320] text-[14px] font-semibold text-[#EDE9E1]">
          {initials(o.controllerName)}
        </span>
        <span className={`flex min-w-0 flex-1 items-center gap-3 self-stretch py-3 pr-4 ${last ? '' : 'border-b border-[#2A2723]'}`}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-medium leading-snug text-[#EDE9E1]">
              {who(o)} <span className="text-[#A39B8F]">{['read', 'updated', 'exported', 'shared'][o.eventType]}</span>
            </span>
            <span className="block truncate text-[14px] leading-snug text-[#A39B8F]">
              {o.purposeText} · {ago(o)}
            </span>
          </span>
          {sealing(o) ? <span className="shrink-0 text-[13px] font-medium text-[#F2A33A]">Sealing…</span> : <Ok />}
        </span>
      </a>
    </li>
  )
}

function Groups({ receipts, selectedId }: { receipts: ReceiptOpening[]; selectedId?: string }) {
  return (
    <div className="flex flex-col gap-6">
      {buckets(receipts).map((g) => (
        <section key={g.key} aria-labelledby={`b-${g.key}`}>
          <h2 id={`b-${g.key}`} className="px-1 pb-2.5 text-[15px] font-semibold text-[#EDE9E1]">
            {g.label}
          </h2>
          <ul className="overflow-hidden rounded-[20px] bg-[#1C1A17]">
            {g.items.map((o, i) => (
              <Row key={o.eventId} o={o} selected={o.eventId === selectedId} last={i === g.items.length - 1} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** Gauge pill (Opal's 53 / 90 / 100): the count inside, its name under it. Never red unless something is altered. */
function Gauge({ n, label, tone, icon }: { n: number; label: string; tone: 'ice' | 'amber' | 'quiet'; icon: ReactNode }) {
  const cls = tone === 'ice' ? 'border-[#9BD9E0]/60 text-[#9BD9E0]' : tone === 'amber' ? 'border-[#F2A33A]/60 text-[#F2A33A]' : 'border-[#4A453E] text-[#A39B8F]'
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className={`flex h-9 min-w-[72px] items-center justify-center gap-1.5 rounded-pill border-[1.5px] px-3 text-[15px] font-semibold ${cls}`}>
        {icon}
        <span className="tnum">{n}</span>
      </span>
      <span className="text-[13px] text-[#A39B8F]">{label}</span>
    </div>
  )
}

/** The seal as the hero object, glowing the colour of the verdict. */
function Orb({ size = 188, score, total }: { size?: number; score: number; total: number }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative flex items-center justify-center" style={{ width: size + 80, height: size + 20 }}>
        <div
          aria-hidden="true"
          className="idn-glow absolute rounded-full blur-2xl"
          style={{ width: size * 1.15, height: size * 1.15, background: 'radial-gradient(circle, rgb(91 203 138 / 0.34), rgb(155 217 224 / 0.12) 48%, transparent 70%)' }}
        />
        <div className="relative" style={{ width: size }}>
          <VerdictSeal tone="ok" />
        </div>
      </div>
      <p className="mt-1 flex items-baseline gap-1 text-[#EDE9E1]" aria-label={`${score} of ${total} receipts match the chain`}>
        <span className="doto text-[72px]">{score}</span>
        <span className="doto text-[34px] text-[#A39B8F]">/{total}</span>
      </p>
      <p className="mt-2 text-[17px] font-medium text-[#EDE9E1]">sealed receipts match the chain</p>
      <p className="mt-1.5 flex items-center gap-2 text-[14px] text-[#A39B8F]">
        <span aria-hidden="true" className="idn-live h-2 w-2 rounded-full bg-[#5BCB8A]" /> Checked by your phone · 3 s ago
      </p>
    </div>
  )
}

function TabBar() {
  const items: Array<[string, ReactNode, boolean]> = [
    ['Receipts', <IconReceipt key="r" size={20} />, true],
    ['Verify', <IconShield key="v" size={20} />, false],
    ['Profile', <IconUser key="p" size={20} />, false],
  ]
  return (
    <nav aria-label="Citizen" className="fixed inset-x-0 bottom-5 z-20 flex justify-center px-4">
      <ul className="idn-glass flex h-[64px] items-center gap-2 rounded-pill border border-[#33302B] px-3 shadow-[0_16px_40px_rgb(0_0_0/0.5)]">
        {items.map(([label, icon, active]) => (
          <li key={label}>
            <a href="#" aria-current={active ? 'page' : undefined} className={`flex h-12 w-[78px] flex-col items-center justify-center gap-0.5 rounded-pill ${active ? 'bg-[#EDE9E1]/10 text-[#EDE9E1]' : 'text-[#A39B8F] hover:text-[#EDE9E1]'}`}>
              {icon}
              <span className="text-[11px] font-medium">{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function CodeChip() {
  return (
    <button type="button" aria-label={`Copy your code ${CODE.split('').join(' ')}`} className="flex h-9 items-center gap-2 rounded-pill border border-[#33302B] bg-[#1C1A17] pl-3.5 pr-3 font-mono text-[14px] font-medium tracking-[0.08em] text-[#EDE9E1]">
      {CODE}
      <IconCopy size={14} className="text-[#9BD9E0]" />
    </button>
  )
}

// ---- detail pieces -----------------------------------------------------------------------------

function MatchMoment({ wide = false }: { wide?: boolean }) {
  return (
    <section aria-label="Verdict" className="idn-rise relative overflow-hidden rounded-[28px] border border-[#5BCB8A]/25 bg-[#1C1A17] px-6 pb-6 pt-4 text-center">
      <div
        aria-hidden="true"
        className="idn-glow absolute left-1/2 top-2 h-[220px] w-[220px] -translate-x-1/2 rounded-full blur-2xl"
        style={{ background: 'radial-gradient(circle, rgb(91 203 138 / 0.32), transparent 68%)' }}
      />
      <div className="relative mx-auto" style={{ width: wide ? 168 : 136 }}>
        <VerdictSeal tone="ok" />
      </div>
      <p className="relative mt-2 text-[28px] font-semibold leading-tight tracking-[-0.025em] text-[#EDE9E1]">
        Matches the chain<span className="text-[#5BCB8A]">.</span>
      </p>
      <p className="relative mt-1 text-[14px] text-[#A39B8F]">Verified by your phone, not by our server</p>
      <div className="relative mt-5 grid grid-cols-3 divide-x divide-[#2E2B26] rounded-[16px] bg-[#12110F]/70 py-3">
        <div>
          <p className="doto text-[26px] text-[#5BCB8A]">1.84</p>
          <p className="mt-1.5 text-[12px] text-[#A39B8F]">seconds</p>
        </div>
        <div>
          <p className="doto text-[26px] text-[#EDE9E1]">{MATCH.confirmations}</p>
          <p className="mt-1.5 text-[12px] text-[#A39B8F]">confirmations</p>
        </div>
        <div>
          <p className="doto text-[26px] text-[#EDE9E1]">0</p>
          <p className="mt-1.5 text-[12px] text-[#A39B8F]">fields changed</p>
        </div>
      </div>
    </section>
  )
}

function Facts({ o }: { o: ReceiptOpening }) {
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
      <span key="f" className="inline-flex items-center gap-2 font-mono text-[14px] text-[#9BD9E0]">
        {f.fingerprint} <IconCopy size={13} />
      </span>,
    ],
  ]
  return (
    <dl className="overflow-hidden rounded-[20px] bg-[#1C1A17]">
      {rows.map(([k, val], i) => (
        <div key={k} className={`flex min-h-12 items-center gap-4 px-4 py-2.5 ${i ? 'border-t border-[#2A2723]' : ''}`}>
          <dt className="shrink-0 text-[14px] text-[#A39B8F]">{k}</dt>
          <dd className="ml-auto min-w-0 truncate text-right text-[15px] text-[#EDE9E1]">{val}</dd>
        </div>
      ))}
    </dl>
  )
}

function Actions() {
  return (
    <div className="flex flex-col gap-2.5">
      <button type="button" className="flex h-14 w-full items-center justify-center gap-2 rounded-pill bg-[#EDE9E1] text-[16px] font-semibold text-[#12110F]">
        <IconShield size={17} /> Check on chain again
      </button>
      <button type="button" className="flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-[#262320] text-[15px] font-medium text-[#EDE9E1]">
        <IconSpark size={15} className="text-[#BDB4F8]" /> Explain with AI
      </button>
      <div className="mt-1 flex items-center justify-center gap-5 text-[14px] font-medium text-[#A39B8F]">
        <a href="#" className="flex min-h-11 items-center gap-1.5 hover:text-[#EDE9E1]">
          <IconDownload size={14} /> Save
        </a>
        <a href="#" className="flex min-h-11 items-center gap-1.5 hover:text-[#EDE9E1]">
          <IconShare size={14} /> Share proof
        </a>
        <a href="#" className="flex min-h-11 items-center hover:text-[#EDE9E1]">
          Report a problem
        </a>
      </div>
    </div>
  )
}

function Hero({ o, big = false }: { o: ReceiptOpening; big?: boolean }) {
  return (
    <div>
      <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-[#262320] text-[18px] font-semibold text-[#EDE9E1]">
        {initials(o.controllerName)}
      </span>
      <h1 className={`mt-4 font-semibold leading-[1.12] tracking-[-0.025em] text-[#EDE9E1] ${big ? 'text-[34px]' : 'text-[26px]'}`}>
        {who(o)} <span className="text-[#A39B8F]">shared your data with a third party</span>
      </h1>
      <p className="mt-2 text-[15px] text-[#A39B8F]">
        Today, {clock(o)} WIB · {o.purposeText}
      </p>
    </div>
  )
}

// ---- screens -----------------------------------------------------------------------------------

export function BHome() {
  return (
    <div className="idn-root min-h-dvh bg-[#12110F] px-4 pb-32 pt-4 text-[#EDE9E1]">
      <header className="flex h-12 items-center justify-between">
        <span className="flex items-center gap-2.5">
          <LogoMark tone="vault" />
          <span className="text-[19px] font-semibold tracking-[-0.04em]">saksi</span>
        </span>
        <CodeChip />
      </header>
      <h1 className="sr-only">Receipts</h1>
      <div className="mt-2">
        <Orb score={4} total={4} />
      </div>
      <div className="mt-6 flex justify-center gap-3">
        <Gauge n={4} label="Sealed" tone="ice" icon={<IconLock size={14} />} />
        <Gauge n={1} label="Sealing" tone="amber" icon={<IconClock size={14} />} />
        <Gauge n={0} label="Altered" tone="quiet" icon={<IconX size={13} strokeWidth={2.4} />} />
      </div>
      <div className="mt-8">
        <Groups receipts={HOME} />
      </div>
      <TabBar />
    </div>
  )
}

export function BDetail() {
  return (
    <div className="idn-root min-h-dvh bg-[#12110F] px-4 pb-10 pt-4 text-[#EDE9E1]">
      <header className="flex h-12 items-center justify-between">
        <a href="#" aria-label="Back to receipts" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1C1A17]">
          <IconArrow size={16} className="rotate-180" />
        </a>
        <span className="text-[16px] font-semibold">Receipt</span>
        <button type="button" aria-label="Share" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1C1A17]">
          <IconShare size={15} />
        </button>
      </header>
      <div className="mt-4">
        <Hero o={OPENING} />
      </div>
      <div className="mt-6">
        <MatchMoment />
      </div>
      <div className="mt-6">
        <Facts o={OPENING} />
      </div>
      <div className="mt-6">
        <Actions />
      </div>
    </div>
  )
}

export function BWorkspace() {
  const nav: Array<[string, ReactNode, boolean]> = [
    ['Receipts', <IconReceipt key="r" size={17} />, true],
    ['Verify a receipt', <IconShield key="v" size={17} />, false],
    ['Profile', <IconUser key="p" size={17} />, false],
  ]
  return (
    <div className="idn-root grid h-dvh grid-cols-[240px_420px_minmax(0,1fr)] overflow-hidden bg-[#12110F] text-[#EDE9E1]">
      <aside className="flex flex-col border-r border-[#2A2723] bg-[#0E0D0B] px-4 py-5">
        <span className="flex items-center gap-2.5 px-2">
          <LogoMark tone="vault" />
          <span className="text-[19px] font-semibold tracking-[-0.04em]">saksi</span>
        </span>
        <ul className="mt-7 flex flex-col gap-1">
          {nav.map(([label, icon, active]) => (
            <li key={label}>
              <a href="#" aria-current={active ? 'page' : undefined} className={`flex h-10 items-center gap-3 rounded-[12px] px-3 text-[15px] font-medium ${active ? 'bg-[#1C1A17] text-[#EDE9E1]' : 'text-[#A39B8F] hover:text-[#EDE9E1]'}`}>
                {icon}
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-auto rounded-[18px] border border-[#2A2723] bg-[#1C1A17] p-4">
          <p className="text-[13px] text-[#A39B8F]">Your code</p>
          <p className="doto mt-2 text-[28px] tracking-[0.06em]">{CODE}</p>
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[#9BD9E0]">
            <IconCopy size={13} /> Copy
          </p>
        </div>
      </aside>
      <section className="flex min-h-0 flex-col border-r border-[#2A2723]">
        <header className="flex items-center gap-4 px-6 pb-5 pt-6">
          <div className="relative h-[64px] w-[64px] shrink-0">
            <div aria-hidden="true" className="idn-glow absolute -inset-3 rounded-full blur-xl" style={{ background: 'radial-gradient(circle, rgb(91 203 138 / 0.35), transparent 70%)' }} />
            <div className="relative">
              <VerdictSeal tone="ok" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold tracking-[-0.025em]">Receipts</h1>
            <p className="mt-0.5 flex items-center gap-2 text-[14px] text-[#A39B8F]">
              <span className="doto text-[18px] text-[#EDE9E1]">8/8</span> match the chain · 3 s ago
            </p>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
          <Groups receipts={WS} selectedId={OPENING.eventId} />
        </div>
      </section>
      <main className="min-h-0 overflow-y-auto">
        <div className="mx-auto grid max-w-[860px] grid-cols-[minmax(0,1fr)_340px] items-start gap-8 px-10 py-10">
          <div className="flex flex-col gap-6">
            <Hero o={OPENING} big />
            <Facts o={OPENING} />
            <Actions />
          </div>
          <MatchMoment wide />
        </div>
      </main>
    </div>
  )
}
