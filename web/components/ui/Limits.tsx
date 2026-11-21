import { IconCheck, IconX } from './icons'

export const PROVES = [
  'The record wasn’t changed after it was sealed.',
  'When the chain received it.',
]

export const DOES_NOT_PROVE = [
  'That every access was recorded.',
  'That the access was lawful.',
  'The real discovery time.',
  'That notifications were actually sent.',
]

/** PROVES / DOES NOT PROVE — used on the landing page and in the receipt "What does Saksi prove?" sheet. */
export function Limits({ compact }: { compact?: boolean }) {
  return (
    <div className={`grid gap-px overflow-hidden rounded-lg border border-line bg-line ${compact ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
      <div className="bg-card p-5 md:p-7">
        <p className="label flex items-center gap-2 text-ok">
          <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-ok text-white">
            <IconCheck size={13} strokeWidth={2.8} />
          </span>
          Saksi proves
        </p>
        <ul className="mt-4 flex flex-col">
          {PROVES.map((p) => (
            <li key={p} className="flex gap-3 border-t border-line py-3 text-[15px] leading-snug text-ink first:border-t-0">
              <IconCheck size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ok" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-card p-5 md:p-7">
        <p className="label flex items-center gap-2 text-ink-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-ink-2 text-white">
            <IconX size={13} strokeWidth={2.8} />
          </span>
          Saksi does not prove
        </p>
        <ul className="mt-4 flex flex-col">
          {DOES_NOT_PROVE.map((p) => (
            <li key={p} className="flex gap-3 border-t border-line py-3 text-[15px] leading-snug text-ink-2 first:border-t-0">
              <IconX size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ink-3" />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
