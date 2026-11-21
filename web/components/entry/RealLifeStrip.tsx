import type { CSSProperties } from 'react'
import { ROLE_META } from './RoleChip'
import './entry.css'

/**
 * "How Saksi works in real life": four steps on one ticket, separated by perforations.
 * Desktop: four columns with vertical perforations. Phone: four rows with horizontal perforations.
 */

const SAKSI = '#6b645b'

const STEPS: { who: string; accent: string; title: string; body: string }[] = [
  {
    who: 'Agency',
    accent: ROLE_META.agency.accent,
    title: 'An officer looks up your NIK',
    body: 'At a bank, hospital or agency, through its own system or the Dukcapil gateway.',
  },
  {
    who: 'Saksi',
    accent: SAKSI,
    title: 'That system calls Saksi, automatically',
    body: 'Saksi seals a fingerprint of the access on a public ledger. No NIK or personal data goes on it.',
  },
  {
    who: 'Citizen',
    accent: ROLE_META.citizen.accent,
    title: 'You get a receipt, and your phone checks it',
    body: 'In the app you already use (in production, IKD or SatuSehat). If the agency edits or deletes the record later, it turns red.',
  },
  {
    who: 'Regulator',
    accent: ROLE_META.regulator.accent,
    title: 'The regulator sees every record',
    body: 'Komdigi today, the PDP agency later: every agency’s record and every citizen report.',
  },
]

export function RealLifeStrip() {
  return (
    <section aria-labelledby="real-life-title" className="flex flex-col gap-3">
      <h2 id="real-life-title" className="text-[15px] font-semibold text-ink">
        How Saksi works in real life
      </h2>
      <ol className="en-strip en-shadow">
        {STEPS.map((s, i) => (
          <li key={s.who} className="en-step" style={{ '--i': i, '--role': s.accent } as CSSProperties}>
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="en-step-n">
                {i + 1}
              </span>
              <span className="text-[13px] font-medium" style={{ color: s.accent }}>
                {s.who}
              </span>
            </div>
            <p className="mt-2.5 text-[16px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink">{s.title}</p>
            <p className="mt-1 text-[14px] leading-[1.5] text-ink-2">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="text-[14px] text-ink-2">In this prototype, you can play all three roles.</p>
    </section>
  )
}
