/** Digits in Doto; '.' and ':' pulled tight in Geist Mono; letters and the unit in Geist Mono. Never a Doto letter. */
export function DotoValue({ value, unit, className = '' }: { value: string; unit?: string; className?: string }) {
  return (
    <span className={`inline-flex items-baseline whitespace-nowrap ${className}`}>
      {value.split(/(\d+|[.:])/).map((p, i) => {
        if (!p) return null
        if (/^\d+$/.test(p)) return <span key={i} className="doto">{p}</span>
        if (p === '.' || p === ':') return <span key={i} className="mx-[0.02em] font-mono font-medium leading-none">{p}</span>
        return <span key={i} className="font-mono text-[0.6em] font-medium uppercase leading-none tracking-[0.04em]">{p}</span>
      })}
      {unit ? <span className="ml-[0.12em] font-mono text-[0.4em] font-medium uppercase leading-none tracking-[0.04em] opacity-70">{unit}</span> : null}
    </span>
  )
}
