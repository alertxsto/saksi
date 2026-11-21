import type { CSSProperties } from 'react'
import { ROLE_META } from '@/components/entry/RoleChip'
import { IconArrow } from '@/components/ui/icons'
import './integrate.css'

const SAKSI = '#6b645b'
const AGENCY = ROLE_META.agency.accent

const STOPS: { who: string; accent: string; title: string; body: string; n?: number }[] = [
  {
    who: 'Agency',
    accent: AGENCY,
    title: 'Agency system',
    body: 'An officer opens a citizen record. Your hook fires in that same code path.',
  },
  {
    n: 1,
    who: 'Saksi',
    accent: SAKSI,
    title: 'Saksi API prepares',
    body: 'Your backend sends the citizen code, purpose and legal basis. Saksi returns what to sign.',
  },
  {
    n: 2,
    who: 'Agency',
    accent: AGENCY,
    title: 'The agency signs',
    body: 'logAccess goes out from your registered wallet or HSM. Saksi never holds the key.',
  },
  {
    n: 3,
    who: 'Saksi, then the citizen',
    accent: SAKSI,
    title: 'Saksi seals and notifies the citizen',
    body: 'Saksi checks the transaction on the public ledger. The citizen’s phone gets a receipt it can check.',
  },
]

/**
 * The integration in three steps on one ticket: agency system → Saksi API (prepare) → agency signs →
 * Saksi seals and notifies the citizen. Desktop: four columns, vertical perforations, an arrow chip on each.
 * Phone: rows with horizontal perforations, the arrow pointing down.
 */
export function SealPath() {
  return (
    <figure aria-labelledby="seal-path-cap" className="flex flex-col gap-3">
      <figcaption id="seal-path-cap" className="text-[15px] font-semibold text-ink">
        How one access gets sealed
      </figcaption>
      <ol className="ig-path ig-shadow">
        {STOPS.map((s, i) => (
          <li key={s.title} className="ig-stop" style={{ '--role': s.accent } as CSSProperties}>
            {i > 0 ? (
              <span aria-hidden="true" className="ig-hop">
                <IconArrow size={13} />
              </span>
            ) : null}
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="ig-disc" data-solid={s.n ? undefined : ''}>
                {s.n ?? ROLE_META.agency.initial}
              </span>
              <span className="text-[13px] font-medium" style={{ color: s.accent }}>
                <span className="sr-only">{s.n ? `Step ${s.n}: ` : 'Start: '}</span>
                {s.who}
              </span>
            </div>
            <p className="text-[17px] font-semibold leading-[1.25] tracking-[-0.015em] text-ink">{s.title}</p>
            <p className="text-[14px] leading-[1.5] text-ink-2">{s.body}</p>
          </li>
        ))}
      </ol>
    </figure>
  )
}
