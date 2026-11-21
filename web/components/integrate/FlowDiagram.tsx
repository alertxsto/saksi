import type { CSSProperties } from 'react'
import './integrate.css'

const LANES = [
  { name: 'Your system', sub: 'agency backend' },
  { name: 'Saksi API', sub: 'commitments, checks' },
  { name: 'Sepolia', sub: 'AccessJournal', chain: true },
  { name: 'Citizen · Regulator', sub: 'phone · Watch' },
] as const

type Arrow = { from: number; to: number; label: string; detail?: string; back?: boolean }
type Step = { n: string; title: string; arrows: Arrow[]; at?: number; note?: string }

/** The access flow exactly as lib/client/controller.ts and scripts/agency-example.mjs run it. */
const STEPS: Step[] = [
  { n: '01', title: 'An officer opens a citizen record', at: 0, arrows: [], note: 'your hook fires' },
  {
    n: '02',
    title: 'Prepare the commitment',
    arrows: [
      { from: 0, to: 1, label: 'POST /access/prepare', detail: 'citizen code · purpose · basis · event' },
      { from: 1, to: 0, label: 'id · submitToken · args', back: true },
    ],
  },
  {
    n: '03',
    title: 'Sign with your registered key',
    arrows: [{ from: 0, to: 2, label: 'logAccess(args)', detail: 'your wallet or HSM signs; Saksi never holds the key' }],
  },
  {
    n: '04',
    title: 'Submit the transaction hash',
    arrows: [
      { from: 0, to: 1, label: 'POST /access/submit', detail: 'id · txHash · submitToken' },
      { from: 1, to: 2, label: 'reads the tx', detail: 'contract · args · signer', back: true },
    ],
  },
  {
    n: '05',
    title: 'Confirm once mined',
    arrows: [
      { from: 0, to: 1, label: 'POST /access/confirm' },
      { from: 1, to: 0, label: 'anchored', back: true },
    ],
  },
  {
    n: '06',
    title: 'The citizen gets the receipt',
    arrows: [{ from: 2, to: 3, label: 'verified in the browser', detail: 'Watch reconciles chain vs database' }],
  },
]

const centre = (lane: number) => `${((lane + 0.5) / LANES.length) * 100}%`

function ArrowLine({ a }: { a: Arrow }) {
  const lo = Math.min(a.from, a.to)
  const hi = Math.max(a.from, a.to)
  const right = a.to > a.from
  const style = { left: centre(lo), width: `${((hi - lo) / LANES.length) * 100}%` } as CSSProperties
  return (
    <div className="ig-arrow absolute top-0 h-full" style={style}>
      <p className="absolute inset-x-3 bottom-[calc(50%+6px)] truncate text-center font-mono text-[13px] text-ink">{a.label}</p>
      <div className={`absolute inset-x-0 top-1/2 ${a.back ? 'border-t border-dashed border-line-strong' : 'h-px bg-ink'}`} />
      <span
        aria-hidden="true"
        className={`absolute top-1/2 size-[7px] -translate-y-1/2 rounded-full ${a.back ? 'bg-line-strong' : 'bg-ink'} ${right ? '-left-[3px]' : '-right-[3px]'}`}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 8 10"
        className={`absolute top-1/2 h-[10px] w-2 -translate-y-1/2 ${right ? '-right-px' : '-left-px rotate-180'} ${a.back ? 'text-ink-3' : 'text-ink'}`}
      >
        <path d="M0 0 8 5 0 10z" fill="currentColor" />
      </svg>
      {a.detail ? (
        <p className="absolute inset-x-3 top-[calc(50%+7px)] truncate text-center text-[12px] text-ink-2">{a.detail}</p>
      ) : null}
    </div>
  )
}

/**
 * Sequence diagram of one sealed access: four lanes with hairline lifelines, solid arrows for calls, dashed
 * for answers and Saksi's own chain reads, dots where each call starts. Below md it becomes a numbered list.
 */
export function FlowDiagram() {
  return (
    <>
      <figure aria-labelledby="flow-cap" className="hidden overflow-hidden rounded-lg border border-line bg-card md:block">
        <figcaption id="flow-cap" className="sr-only">
          Sequence of one sealed access between your system, the Saksi API, Sepolia, and the citizen and regulator.
        </figcaption>
        <div className="relative grid grid-cols-[168px_1fr] lg:grid-cols-[208px_1fr]">
          {/* lifelines */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[168px] right-0 lg:left-[208px]">
            {LANES.map((l, i) => (
              <span key={l.name} className="absolute inset-y-0 w-px bg-line" style={{ left: centre(i) }} />
            ))}
          </div>

          {/* lane headers */}
          <div className="border-b border-line" />
          <div className="relative grid grid-cols-4 border-b border-line">
            {LANES.map((l) => (
              <div key={l.name} className="relative flex justify-center px-2 py-5">
                <div
                  className={`flex min-w-[148px] flex-col items-center rounded-md border px-3 py-2.5 text-center text-ink ${
                    'chain' in l ? 'border-line bg-paper-2' : 'border-line-strong bg-card'
                  }`}
                >
                  <span className="text-[14px] font-medium">{l.name}</span>
                  <span className="mt-0.5 text-[12px] text-ink-3">{l.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {STEPS.map((s, i) => (
            <div key={s.n} className="contents">
              <div className={`flex gap-3 px-5 py-5 ${i < STEPS.length - 1 ? 'border-b border-line' : ''}`}>
                <span aria-hidden="true" className="ig-disc">
                  {Number(s.n)}
                </span>
                <p className="pt-[3px] text-[14px] font-medium leading-[1.35] text-ink">{s.title}</p>
              </div>
              <div className={`relative ${i < STEPS.length - 1 ? 'border-b border-line' : ''}`}>
                {s.at !== undefined ? (
                  <div className="flex h-[72px] items-center">
                    <div className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: centre(s.at) }}>
                      <span className="whitespace-nowrap rounded-pill bg-ink px-3 py-1.5 text-[13px] font-medium text-paper">
                        Record opened
                      </span>
                      {s.note ? <span className="mt-1.5 text-[12px] text-ink-2">{s.note}</span> : null}
                    </div>
                  </div>
                ) : (
                  s.arrows.map((a, k) => (
                    <div key={k} className="relative h-[72px]">
                      <ArrowLine a={a} />
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </figure>

      <ol className="flex flex-col border-b border-line md:hidden">
        {STEPS.map((s) => (
          <li key={s.n} className="grid grid-cols-[26px_1fr] gap-x-3 border-t border-line py-5">
            <span aria-hidden="true" className="ig-disc">
              {Number(s.n)}
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-medium leading-[1.35] text-ink">{s.title}</p>
              {s.at !== undefined ? <p className="mt-1.5 text-[13px] text-ink-2">{LANES[s.at].name} · {s.note}</p> : null}
              <ul className="mt-2 flex flex-col gap-2">
                {s.arrows.map((a, k) => (
                  <li key={k} className="text-[13px] leading-[1.45]">
                    <span className="text-[12px] text-ink-3">
                      {LANES[a.from].name} {a.back ? '⇠' : '→'} {LANES[a.to].name}
                    </span>
                    <span className="mt-0.5 block font-mono text-[13px] text-ink">{a.label}</span>
                    {a.detail ? <span className="block text-ink-2">{a.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}
