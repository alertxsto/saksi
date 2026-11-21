export type StackPart = { key: string; value: number; className: string; label: string }

/**
 * One 6 px stacked bar under a KPI row (Mobbin R1, Cloudflare severity): each verdict's share of all
 * receipts. Segments ease to their new width (600 ms expo), so a fresh ALTERED grows out of nothing.
 */
export function StackBar({ parts, label }: { parts: StackPart[]; label: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  return (
    <div
      role="img"
      aria-label={`${label}: ${parts.map((p) => `${p.value} ${p.label}`).join(', ')}`}
      className="flex h-1.5 w-full overflow-hidden rounded-full"
    >
      {total === 0 ? (
        <span className="h-full w-full rounded-full bg-line" />
      ) : (
        parts.map((p, i) => (
          <span
            key={p.key}
            className={`h-full rounded-full transition-[flex-grow] duration-[600ms] ease-[var(--ease-out-expo)] ${p.className} ${
              p.value && parts.slice(0, i).some((q) => q.value) ? 'ml-[3px]' : ''
            }`}
            style={{ flexGrow: p.value, flexBasis: 0, minWidth: p.value ? 6 : 0 }}
          />
        ))
      )}
    </div>
  )
}
