import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { ROLE_META, type Actor } from '@/components/entry/RoleChip'
import { IconArrow, IconCheck } from '@/components/ui/icons'
import './why.css'

type Case = {
  title: string
  law: string
  today: ReactNode
  saksi: ReactNode
  actor: Actor
  try: { href: string; label: string }
}

const CASES: Case[] = [
  {
    title: 'Your NIK used by a loan app you never applied to',
    law: 'UU PDP Pasal 32 · Pasal 12',
    today:
      'A lending app checks your NIK through the Dukcapil gateway. You find out months later, when a debt collector calls.',
    saksi: (
      <>
        A receipt lands at <span className="tnum font-semibold text-ink">02:13</span>: “Contoh Lending Co. read your data,
        credit score check”. You tap <span className="font-semibold text-ink">Not me</span>, and the regulator gets the report
        with the sealed record attached.
      </>
    ),
    actor: 'citizen',
    try: { href: '/enter?as=citizen', label: 'Try it as the citizen' },
  },
  {
    title: 'Your medical record opened by staff who don’t treat you',
    law: 'UU PDP Pasal 31',
    today: 'The hospital’s access log lives in the hospital’s own system. A curious lookup looks like any other.',
    saksi:
      'Your receipt names the hospital system, the officer reference and the stated purpose. A purpose that has nothing to do with your care stands out, and nobody can rewrite it later.',
    actor: 'agency',
    try: { href: '/enter?as=agency', label: 'Try it as the agency' },
  },
  {
    title: 'A breach covered up by deleting the logs',
    law: 'UU PDP Pasal 46',
    today: 'After a breach, access rows can be edited or deleted. The only copy belongs to the party under suspicion.',
    saksi:
      'Every access was sealed when it happened. Edit or delete the rows and every affected phone turns red: “Changed after sealing” or “Deleted by the agency”.',
    actor: 'agency',
    try: { href: '/operator', label: 'Try it: agency, then the evidence room' },
  },
  {
    title: 'The regulator audits without an on-site inspection',
    law: 'UU PDP Pasal 46 · Pasal 31',
    today: 'Supervision means letters and site visits, and the agency UU PDP created has not been formed yet.',
    saksi:
      'The regulator reads the same sealed records. Agencies with a tampered record or a late breach notice are flagged before anyone visits.',
    actor: 'regulator',
    try: { href: '/enter?as=regulator', label: 'Try it as the regulator' },
  },
]

/** /why "Real cases": four case tickets. Top: the case and its legal ground. Then today vs with Saksi, split by a perforation. */
export function RealCases() {
  return (
    <ol className="grid gap-4 md:grid-cols-2 md:gap-5" aria-label="Real cases">
      {CASES.map((c, i) => {
        const meta = ROLE_META[c.actor]
        return (
          <li key={c.title} className="wy-case wy-shadow" style={{ '--i': i, '--role': meta.accent } as CSSProperties}>
            <article className="flex h-full flex-col">
              <div className="wy-top flex flex-1 flex-col bg-card px-5 pb-5 pt-5 md:px-7 md:pt-6">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="wy-n">
                    {i + 1}
                  </span>
                  <span className="inline-flex h-7 items-center rounded-pill border border-line px-2.5 text-[13px] text-ink-2">
                    {c.law}
                  </span>
                </div>
                <h3 className="mt-4 text-[22px] font-semibold leading-[1.18] tracking-[-0.02em] text-ink md:text-[24px]">{c.title}</h3>
                <div className="mt-4 flex gap-3">
                  <span aria-hidden="true" className="wy-today-dot" />
                  <p className="text-[15px] leading-[1.55] text-ink-2">
                    <span className="font-medium text-ink">Today. </span>
                    {c.today}
                  </p>
                </div>
              </div>
              <div className="wy-stub relative flex flex-col bg-card px-5 pb-5 pt-5 md:px-7 md:pb-6">
                <div aria-hidden="true" className="wy-perf absolute inset-x-5 top-0 text-line-strong md:inset-x-7" />
                <div className="flex gap-3">
                  <span aria-hidden="true" className="wy-saksi-tick">
                    <IconCheck size={12} strokeWidth={3} />
                  </span>
                  <p className="text-[15px] leading-[1.55] text-ink-2">
                    <span className="font-medium text-ink">With Saksi. </span>
                    {c.saksi}
                  </p>
                </div>
                <Link href={c.try.href} className="wy-try group mt-5 inline-flex min-h-11 items-center gap-2.5 self-start rounded-pill border border-line-strong pl-1.5 pr-4 text-[14px] font-medium text-ink">
                  <span aria-hidden="true" className="wy-try-disc">
                    {meta.initial}
                  </span>
                  {c.try.label}
                  <IconArrow size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </article>
          </li>
        )
      })}
    </ol>
  )
}
