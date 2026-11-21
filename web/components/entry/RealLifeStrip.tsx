import Link from 'next/link'
import type { CSSProperties } from 'react'
import { IconArrow } from '@/components/ui/icons'
import { ROLE_META } from './RoleChip'
import './entry.css'

/**
 * "How Saksi works in real life": four short steps on one ticket, separated by perforations, kept to a single
 * compact row on desktop so the three doors below stay above the fold. The long version lives on /why.
 * Phone: four one-line rows with horizontal perforations.
 */

const SAKSI = '#6b645b'

const STEPS: { who: string; accent: string; title: string }[] = [
  { who: 'Agency', accent: ROLE_META.agency.accent, title: 'An officer opens your record' },
  { who: 'Saksi', accent: SAKSI, title: 'Saksi seals the access' },
  { who: 'Citizen', accent: ROLE_META.citizen.accent, title: 'Your phone gets a receipt' },
  { who: 'Regulator', accent: ROLE_META.regulator.accent, title: 'The regulator sees it too' },
]

export function RealLifeStrip() {
  return (
    <section aria-labelledby="real-life-title" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="real-life-title" className="text-[15px] font-semibold text-ink">
          How Saksi works in real life
        </h2>
        <Link
          href="/why"
          className="en-more inline-flex min-h-11 shrink-0 items-center gap-1.5 text-[14px] font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          Learn more
          <IconArrow size={14} />
        </Link>
      </div>
      <ol className="en-strip en-shadow">
        {STEPS.map((s, i) => (
          <li key={s.who} className="en-step" style={{ '--i': i, '--role': s.accent } as CSSProperties}>
            <span aria-hidden="true" className="en-step-n">
              {i + 1}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[12px] font-medium leading-[1.3]" style={{ color: s.accent }}>
                {s.who}
              </span>
              <span className="text-[14px] font-semibold leading-[1.3] tracking-[-0.005em] text-ink">{s.title}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
