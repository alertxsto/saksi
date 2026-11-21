import type { CSSProperties } from 'react'
import { formatWIB } from '@/lib/format'

/**
 * Horizontal 72-hour timeline: discovered → notified, with the 72 H limit as an ink rule (landing breach-clock
 * ruler). The scale stretches past 72 H for late notices; the overrun is amber like the LATE badge (red is
 * reserved for tampering).
 * Motion (CSS, `rg-tl-*` in globals.css): the limit drops in, the used time draws from discovery, the
 * NOTIFIED marker lands, then any overrun runs past the limit. Reduced motion: final state.
 */
export function Timeline72({
  detectedAt,
  anchoredAt,
  mode,
}: {
  detectedAt: number
  anchoredAt: number | null
  mode: 'on_time' | 'late'
}) {
  const hours = anchoredAt ? Math.max(0, (anchoredAt - detectedAt) / 3600) : 0
  const span = Math.max(84, Math.ceil((hours + 12) / 12) * 12)
  const x = (h: number) => `${(h / span) * 100}%`
  const late = mode === 'late' || hours > 72
  const inWindow = Math.min(hours, 72)
  const frac = hours / span
  // Label placement keeps the two markers apart: near the start NOTIFIED sits above the line;
  // past the middle it is right-aligned to its dot.
  const above = frac < 0.3
  const alignEnd = frac >= 0.5
  const drawMs = 500 + 700 * (inWindow / 72)
  const lateBy = Math.round(hours - 72)

  return (
    <figure
      className="rg-tl flex flex-col gap-2"
      style={{ '--draw': `${Math.round(drawMs)}ms` } as CSSProperties}
      aria-label={
        anchoredAt
          ? `Timeline: notified after ${hours.toFixed(1)} of 72 hours${late ? `, late by ${lateBy} hours` : ''}`
          : 'Timeline: not notified yet'
      }
    >
      <div className="relative h-[136px]" aria-hidden="true">
        {/* 72 H limit: drops in first */}
        <span className="rg-tl-drop absolute top-6 h-[52px] w-[2px] -translate-x-1/2 rounded-full bg-ink" style={{ left: x(72) }} />
        <span className="label rg-tl-fade absolute top-0 -translate-x-full whitespace-nowrap pr-2 text-[11px] text-ink" style={{ left: x(72) }}>
          72 H limit
        </span>

        {/* base line + 6-hour ticks */}
        <span className="absolute inset-x-0 top-[68px] h-px bg-line-strong" />
        {Array.from({ length: Math.floor(span / 6) + 1 }, (_, k) => k * 6).map((h) => (
          <span key={h} className={`absolute top-[64px] w-px bg-line-strong ${h % 24 === 0 ? 'h-[9px]' : 'h-[5px] translate-y-[2px]'}`} style={{ left: x(h) }} />
        ))}

        {/* used inside the window: draws from discovery */}
        {anchoredAt ? (
          <span
            className={`rg-tl-draw absolute top-[67px] h-[3px] rounded-full ${late ? 'bg-ink' : 'bg-ok'}`}
            style={{ left: 0, width: x(inWindow) }}
          />
        ) : null}
        {/* overrun past 72 H: runs on after the window is used up */}
        {anchoredAt && late && hours > 72 ? (
          <span className="rg-tl-over absolute top-[65.5px] h-[6px] rounded-full bg-pending" style={{ left: x(72), width: x(hours - 72) }} />
        ) : null}

        {/* DISCOVERED */}
        <span className="absolute left-0 top-[62px] flex flex-col items-start">
          <span className="size-[13px] rounded-full bg-ink ring-4 ring-paper" />
          <span className="mt-3 flex flex-col items-start">
            <span className="label whitespace-nowrap text-[11px] text-ink">Discovered</span>
            <span className="whitespace-nowrap font-mono text-[11px] text-ink-2">{formatWIB(detectedAt * 1000)}</span>
          </span>
        </span>

        {/* NOTIFIED: lands when the draw reaches it */}
        {anchoredAt ? (
          <span
            className={`rg-tl-pop absolute top-[62px] flex flex-col ${alignEnd ? '-translate-x-full items-end' : 'items-start'}`}
            style={{ left: `calc(${x(hours)} ${alignEnd ? '+' : '-'} 6.5px)` }}
          >
            <span className={`size-[13px] rounded-full ring-4 ring-paper ${late ? 'bg-pending' : 'bg-ok'}`} />
            <span className={`flex flex-col ${alignEnd ? 'items-end' : 'items-start'} ${above ? 'absolute bottom-full mb-2.5' : 'mt-3'}`}>
              <span className={`label whitespace-nowrap text-[11px] ${late ? 'text-pending' : 'text-ok'}`}>
                {late ? `Notified · late by ${lateBy} H` : 'Notified'}
              </span>
              <span className="whitespace-nowrap font-mono text-[11px] text-ink-2">
                {formatWIB(anchoredAt * 1000)} · {hours.toFixed(1)} H
              </span>
            </span>
          </span>
        ) : null}
      </div>
      <div className="relative h-4 font-mono text-[11px] text-ink-3" aria-hidden="true">
        {[0, 24, 48, 72, span].map((h, i, all) => (
          <span
            key={h}
            className={`absolute whitespace-nowrap ${i === 0 ? '' : i === all.length - 1 ? '-translate-x-full' : '-translate-x-1/2'} ${h === 72 ? 'text-ink' : ''}`}
            style={{ left: x(h) }}
          >
            {h} H
          </span>
        ))}
      </div>
    </figure>
  )
}
