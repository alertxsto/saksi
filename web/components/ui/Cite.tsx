import { getSource, sourceHref, sourceNumber, type SourceId } from '@/lib/sources'

/**
 * Numbered superscript citation linking to the source list on /why. Mono, 11 px, blue: it reads as a
 * footnote mark at any headline size (vertical-align: super scales with the parent's font, so `top-0`
 * undoes preflight's fixed −0.5em). Several ids render in number order, e.g. "4,7".
 */
export function Cite({ ids, className = '' }: { ids: readonly SourceId[]; className?: string }) {
  return (
    <sup className={`top-0 ml-[0.12em] align-super whitespace-nowrap font-mono text-[11px] font-medium not-italic leading-none tracking-normal ${className}`}>
      {[...ids].sort((a, b) => sourceNumber(a) - sourceNumber(b)).map((id, k) => (
        <span key={id}>
          {k ? ',' : null}
          <a
            href={sourceHref(id)}
            aria-label={`Source ${sourceNumber(id)}: ${getSource(id).publisher}`}
            className="rounded-[3px] px-px text-blue underline-offset-2 transition-colors duration-150 hover:underline"
          >
            {sourceNumber(id)}
          </a>
        </span>
      ))}
    </sup>
  )
}
