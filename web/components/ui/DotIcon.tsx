import type { SVGProps } from 'react'

// 5×5 dot glyphs, same grammar as the logo: big dot = on, tiny dot = empty lattice cell.
const GLYPHS = {
  check: ['00000', '00001', '10010', '01100', '00000'],
  cross: ['10001', '01010', '00100', '01010', '10001'],
  clock: ['01110', '10101', '10111', '10001', '01110'],
  eye: ['00000', '01110', '11011', '01110', '00000'],
  share: ['00110', '00100', '10101', '01010', '10001'],
  export: ['00100', '01110', '00100', '00100', '11111'],
  edit: ['00011', '00110', '01100', '11000', '10000'],
  shield: ['11111', '10001', '10001', '01010', '00100'],
} as const

export type DotIconName = keyof typeof GLYPHS

/** Decorative dot-matrix icon; colour follows currentColor. Pair with text. */
export function DotIcon({ name, size = 16, ...rest }: { name: DotIconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  const rows = GLYPHS[name]
  const dots = []
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const on = rows[y][x] === '1'
      dots.push(
        <circle key={`${x}${y}`} cx={2.5 + x * 4.75} cy={2.5 + y * 4.75} r={on ? 2.1 : 0.55} fill="currentColor" opacity={on ? 1 : 0.35} />,
      )
    }
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...rest}>
      {dots}
    </svg>
  )
}
