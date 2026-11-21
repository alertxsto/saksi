'use client'

import Link from 'next/link'
import { useEffect, useRef, type CSSProperties } from 'react'
import { IconArrow } from '@/components/ui/icons'
import { matches, range, REDUCED_QUERY, subscribe } from '@/lib/motion/scroll'
import { OdoText } from './OdoText'
import { Heading } from './Words'

// 7×7 lattice glyphs on paper: '#' ink dot, 'B' blue terminal, '.' nothing (no background lattice).
const GLYPHS = {
  eye: ['.......', '..###..', '.#...#.', '#..B..#', '.#...#.', '..###..', '.......'],
  padlock: ['..###..', '.#...#.', '.#...#.', '#######', '###B###', '###B###', '#######'],
  shield: ['#######', '#.....#', '#....B#', '#B..B.#', '.#BB.#.', '..#.#..', '...#...'],
} as const
type Glyph = keyof typeof GLYPHS
const SIZE = { '.': 0, '#': 1, B: 1 } as const

const ROLES: { who: string; glyph: Glyph; title: string; body: string; href: string; cta: string }[] = [
  {
    who: 'Citizen',
    glyph: 'eye',
    title: 'See every access.',
    body: 'Get a receipt seconds after a company opens your data, and verify it on your phone. No wallet, no login.',
    href: '/citizen',
    cta: 'Open citizen app',
  },
  {
    who: 'Controller',
    glyph: 'padlock',
    title: 'Prove you complied.',
    body: 'Seal each access and each breach notice from your registered wallet. Compliance anyone can check.',
    href: '/controller',
    cta: 'Record an access',
  },
  {
    who: 'Regulator',
    glyph: 'shield',
    title: 'Audit without asking.',
    body: 'See on-time and late breach notices and every altered row, read straight from the chain.',
    href: '/regulator/watch',
    cta: 'Open Watch',
  },
]

/** A glyph that morphs from `from` (the previous row's glyph) as the row's --q goes 0 → 1, radially. */
function DotGlyph({ shape, from }: { shape: Glyph; from?: Glyph }) {
  const B = GLYPHS[shape]
  const A = from ? GLYPHS[from] : null
  return (
    <svg viewBox="0 0 7 7" className="role-glyph size-12 md:size-14" aria-hidden="true">
      {B.flatMap((row, j) =>
        [...row].map((ch, i) => {
          const a = A ? SIZE[A[j][i] as keyof typeof SIZE] : SIZE['.']
          const b = SIZE[ch as keyof typeof SIZE]
          const dl = Math.hypot(i - 3, j - 3) / 4.3
          return (
            <circle
              key={`${i}-${j}`}
              cx={i + 0.5}
              cy={j + 0.5}
              r={0.4}
              data-k={ch === 'B' ? 'b' : ch === '#' ? 'i' : 'e'}
              style={{ '--a': a, '--b': b, '--dl': dl.toFixed(3) } as CSSProperties}
            />
          )
        }),
      )}
    </svg>
  )
}

/**
 * S6 Roles as numbered editorial rows (15 S6, 16 C.2 S6, 19 B3): no boxes, 1px hairlines that draw
 * themselves, title rising out of a line mask and body clip-wiping in — all scrubbed as each row crosses
 * 92% → 52% of the viewport. Each lattice glyph morphs from the previous row's glyph. Hover: paper-2 row,
 * glyph terminals pulse, arrow nudges 3 px.
 */
export function Roles() {
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list || matches(REDUCED_QUERY)) return
    list.setAttribute('data-live', '')
    const rows = Array.from(list.children) as HTMLElement[]
    return subscribe(() => {
      const vh = window.innerHeight
      for (const r of rows) {
        const top = r.getBoundingClientRect().top
        r.style.setProperty('--q', range(vh * 0.92, vh * 0.52, top).toFixed(3))
      }
    })
  }, [])

  return (
    <section id="roles" aria-labelledby="roles-title" className="relative scroll-mt-24 border-t border-line py-16 md:py-[104px]">
      <div className="frame px-3 md:px-8">
        <Heading id="roles-title" lead="One record." tail="Three people who can check it." className="max-w-[16ch] text-[32px] leading-[1.06] md:text-[48px]" />
        <ol ref={listRef} className="roles mt-12 md:mt-16">
          {ROLES.map((r, i) => (
            <li key={r.who} className="role relative">
              <span aria-hidden="true" className="role-rule absolute inset-x-0 top-0 h-px bg-line" />
              <Link
                href={r.href}
                className="group -mx-3 grid grid-cols-[48px_1fr] items-center gap-x-5 gap-y-3 rounded-lg px-3 py-7 transition-colors duration-150 hover:bg-paper-2 md:-mx-4 md:grid-cols-[56px_minmax(0,1fr)] lg:grid-cols-[56px_minmax(0,1fr)_minmax(0,1.3fr)_auto] md:gap-x-8 md:px-4 md:py-9"
              >
                <DotGlyph shape={r.glyph} from={i ? ROLES[i - 1].glyph : undefined} />
                <span className="min-w-0">
                  <span className="role-mask block overflow-hidden pb-1">
                    <span className="role-title block text-[26px] font-medium leading-[1.1] tracking-[-0.02em] md:text-[36px]">
                      {r.title}
                    </span>
                  </span>
                  <span className="label mt-1 block text-[12px] text-ink-3">
                    0{i + 1} · {r.who}
                  </span>
                </span>
                <span className="role-body col-span-2 max-w-[48ch] text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:col-span-1 md:col-start-2 lg:col-start-auto">
                  {r.body}
                </span>
                <span className="col-span-2 flex items-center gap-2 text-[14px] font-medium text-ink group-hover:text-blue md:col-span-1 md:col-start-2 lg:col-start-auto">
                  <OdoText>{r.cta}</OdoText>
                  <IconArrow size={14} className="transition-transform duration-300 ease-[cubic-bezier(0,0,.2,1)] group-hover:translate-x-[3px]" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <div aria-hidden="true" className="h-px bg-line" />
      </div>
    </section>
  )
}
