/**
 * "18.5 H" in Doto with a decimal point drawn as one Doto-sized dot on the baseline (the landing
 * breach clock draws its colon the same way), so the number reads as one dot-matrix object.
 */
export function HoursValue({ hours, className = '' }: { hours: number; className?: string }) {
  const [int, frac] = hours.toFixed(1).split('.')
  return (
    <span className={`inline-flex items-baseline whitespace-nowrap leading-[0.9] ${className}`} aria-label={`${hours.toFixed(1)} hours`} role="img">
      <span className="doto" aria-hidden="true">
        {int}
      </span>
      <span aria-hidden="true" className="mx-[0.06em] inline-block size-[0.1em] rounded-full bg-current" />
      <span className="doto" aria-hidden="true">
        {frac}
      </span>
      <span aria-hidden="true" className="ml-[0.14em] font-mono text-[0.32em] font-medium tracking-[0.04em] opacity-70">
        H
      </span>
    </span>
  )
}
