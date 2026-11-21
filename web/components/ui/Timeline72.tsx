import { formatWIB } from '@/lib/format'

/**
 * Horizontal 72-hour timeline: discovered → notified, with a red 72 H limit.
 * The scale stretches past 72 H for late notices; the overrun past the limit is drawn red.
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

  const points = [
    { h: 0, k: 'DISCOVERED', dot: 'bg-ink', text: 'text-ink', sub: formatWIB(detectedAt * 1000) },
    ...(anchoredAt
      ? [
          {
            h: hours,
            k: late ? `NOTIFIED · LATE BY ${Math.round(hours - 72)} H` : 'NOTIFIED',
            dot: late ? 'bg-bad' : 'bg-ok',
            text: late ? 'text-bad' : 'text-ok',
            sub: `${formatWIB(anchoredAt * 1000)} · ${hours.toFixed(1)} H`,
          },
        ]
      : []),
  ]

  return (
    <figure
      className="flex flex-col gap-3"
      aria-label={
        anchoredAt
          ? `Timeline: notified after ${hours.toFixed(1)} of 72 hours${late ? `, late by ${Math.round(hours - 72)} hours` : ''}`
          : 'Timeline: not notified yet'
      }
    >
      <div className="relative h-28">
        {/* base line */}
        <span className="absolute left-0 right-0 top-12 h-px bg-line-strong" aria-hidden="true" />
        {/* time used inside the window */}
        <span
          className={`absolute top-[47px] h-[3px] ${late ? 'bg-ink-3' : 'bg-ok'}`}
          style={{ left: 0, width: x(inWindow) }}
          aria-hidden="true"
        />
        {/* overrun past 72 H */}
        {late && hours > 72 ? (
          <span className="absolute top-[46px] h-[5px] bg-bad" style={{ left: x(72), width: x(hours - 72) }} aria-hidden="true" />
        ) : null}
        {/* 72 H limit */}
        <span className="absolute top-3 bottom-6 w-[2px] bg-bad" style={{ left: x(72) }} aria-hidden="true" />
        <span className="label absolute top-1 -translate-x-full whitespace-nowrap pr-2 text-[11px] text-bad" style={{ left: x(72) }}>
          72 H LIMIT
        </span>

        {points.map((p, i) => {
          const frac = p.h / span
          // Label placement keeps the two markers from colliding: near the start the NOTIFIED label
          // sits above the line; past the middle it is right-aligned to its dot.
          const above = i > 0 && frac < 0.25
          const alignEnd = i > 0 && frac >= 0.5
          return (
            <div
              key={p.k}
              className={`absolute top-[42px] flex flex-col ${alignEnd ? '-translate-x-full items-end' : 'items-start'}`}
              style={{ left: i === 0 ? 0 : `calc(${x(p.h)} ${alignEnd ? '+' : '-'} 6px)` }}
            >
              <span className={`h-3 w-3 rounded-full ring-4 ring-card ${p.dot}`} aria-hidden="true" />
              <span
                className={`flex flex-col ${alignEnd ? 'items-end' : 'items-start'} ${above ? 'absolute bottom-full mb-2' : 'mt-3'}`}
              >
                <span className={`label whitespace-nowrap text-[11px] ${p.text}`}>{p.k}</span>
                <span className="whitespace-nowrap font-mono text-[11px] text-ink-2">{p.sub}</span>
              </span>
            </div>
          )
        })}
      </div>
      <div className="relative h-4 font-mono text-[11px] text-ink-2" aria-hidden="true">
        {[0, 24, 48, 72, span].map((h, i, all) => (
          <span
            key={h}
            className={`absolute whitespace-nowrap ${i === 0 ? '' : i === all.length - 1 ? '-translate-x-full' : '-translate-x-1/2'} ${h === 72 ? 'text-bad' : ''}`}
            style={{ left: x(h) }}
          >
            {h} H
          </span>
        ))}
      </div>
    </figure>
  )
}
