'use client'

import { Handles, Illus, K, Rail, eio, pop, spr, ss, useLoop, type IllusProps, type Tick } from './core'

const SEG = ['READ', 'UPDATE', 'EXPORT', 'SHARE']
const WHO = 'Contoh Lending Co.'
const WHY = 'Debt collection'
const REST = [392, 336]
const segX = (i: number) => 131 + i * 50.5
// ledger grid: 0 empty, else colour
const GRID = [K.ice, 0, K.ice, 0, K.blue, K.ice, K.ink, 0, 0] as const
const EMPTY = [1, 3, 7, 8]
const NEW = [K.blue, K.ok, K.ice, K.pend]
const cell = (i: number) => [452 + (i % 3) * 36, 160 + Math.floor(i / 3) * 36]
// cubic connector: button edge → grid
const P = [352, 299, 396, 299, 404, 196, 444, 196]
const bez = (u: number, o: number) => {
  const v = 1 - u
  return v * v * v * P[o] + 3 * v * v * u * P[o + 2] + 3 * v * u * u * P[o + 4] + u * u * u * P[o + 6]
}

const typed = (s: string, t: number, t0: number, t1: number) => s.slice(0, Math.round(s.length * ss(t0, t1, t)))

const tick: Tick = (t, a, k) => {
  const si = (k % 3) + 1
  const fade = 1 - ss(7, 7.5, t)
  const w1 = typed(WHO, t, 0.3, 1.5)
  const w2 = typed(WHY, t, 2.9, 3.9)
  a('t1', { text: w1, opacity: fade })
  a('t2', { text: w2, opacity: fade })
  const cr = t < 1.7 ? [140 + w1.length * 7.2, 144] : t > 2.8 && t < 4.1 ? [140 + w2.length * 7.2, 252] : null
  a('caret', cr ? { x1: cr[0], x2: cr[0], y1: cr[1] - 9, y2: cr[1] + 3, opacity: Math.sin(t * 16) > -0.4 ? 1 : 0 } : { opacity: 0 })
  // cursor: rest → segment → button → rest
  const sg = [segX(si) + 24, 203]
  const bt = [259, 302]
  const m1 = eio((t - 1.4) / 0.9)
  const m2 = eio((t - 3.8) / 0.8)
  const m3 = eio((t - 5.2) / 1.1)
  const cx = REST[0] + (sg[0] - REST[0]) * m1 + (bt[0] - sg[0]) * m2 + (REST[0] - bt[0]) * m3
  const cy = REST[1] + (sg[1] - REST[1]) * m1 + (bt[1] - sg[1]) * m2 + (REST[1] - bt[1]) * m3
  const press = Math.max(ss(2.3, 2.38, t) - ss(2.45, 2.6, t), ss(4.6, 4.68, t) - ss(4.75, 4.9, t))
  a('cur', { transform: `translate(${cx} ${cy}) scale(${1 - 0.14 * press})` })
  const rt = t > 4.6 ? t - 4.6 : t - 2.3
  a('rip', { cx, cy, r: 4 + 16 * ss(0, 0.5, rt), opacity: rt > 0 && rt < 0.5 ? 1 - rt / 0.5 : 0 })
  // segmented slider springs to the clicked verb, then home
  const sx = t < 7 ? segX(0) + (segX(si) - segX(0)) * spr(t - 2.4) : segX(si) + (segX(0) - segX(si)) * spr(t - 7)
  a('seg', { x: sx })
  SEG.forEach((_, i) => a(`s${i}`, { fill: Math.abs(sx - segX(i)) < 25 ? K.card : K.l3 }))
  a('flash', { opacity: ss(4.62, 4.7, t) * (1 - ss(4.9, 5.5, t)) })
  // packet rides the connector, the next empty ledger cell pops in
  const u = eio((t - 4.8) / 1)
  const on = t > 4.8 && t < 5.85
  a('pk', { transform: `translate(${bez(u, 0)} ${bez(u, 1)})`, opacity: on ? 1 : 0 })
  a('wire', { opacity: on ? 1 : 0.0 })
  const [nx, ny] = cell(EMPTY[k % 4])
  const s = Math.max(0, pop(t - 5.8)) * (1 - ss(7, 7.6, t))
  a('new', { transform: `translate(${nx + 14} ${ny + 14}) scale(${s})`, fill: NEW[k % 4] })
  a('nb', { opacity: ss(5.8, 6, t) * fade })
}

export function RecordIllus({ className, framed }: IllusProps) {
  const ref = useLoop(8, tick, 6.2)
  return (
    <Illus
      svgRef={ref}
      className={className}
      framed={framed}
      label="Illustration: a company fills in an access record — who, which action, why — and clicks Seal; the entry travels into the ledger grid as a new cell."
    >
      <Rail y={46} x1={180} x2={470} m={[[214, null], [239, K.l2], [271, K.ice], [310, null], [343, K.blue], [394, null], [423, K.l2], [455, K.pend]]} />
      <Rail y={356} x1={170} x2={480} m={[[200, null], [229, K.ice], [276, null], [309, K.l2], [353, K.ok], [400, null], [433, K.blue], [470, null]]} />

      {/* ledger grid */}
      <path d={`M${P[0]} ${P[1]}C${P.slice(2).join(' ')}`} stroke={K.l2} />
      <path data-a="wire" d={`M${P[0]} ${P[1]}C${P.slice(2).join(' ')}`} stroke={K.blue} opacity={0} />
      <rect x={349} y={296} width={6} height={6} fill={K.ink} />
      {GRID.map((c, i) => {
        const [x, y] = cell(i)
        return c ? <rect key={i} x={x} y={y} width={28} height={28} rx={6} fill={c} /> : <rect key={i} x={x} y={y} width={28} height={28} rx={6} stroke={K.line} />
      })}
      <rect data-a="new" x={-14} y={-14} width={28} height={28} rx={6} fill={K.blue} transform="scale(0)" />
      <Handles x={444} y={152} w={116} h={116} />
      <rect x={452} y={281} width={56} height={5} rx={2.5} fill={K.line} />
      <rect data-a="nb" x={524} y={281} width={28} height={5} rx={2.5} fill={K.ice} opacity={0} />
      <rect data-a="pk" x={-4.5} y={-4.5} width={9} height={9} fill={K.blue} opacity={0} />

      {/* company form */}
      <rect x={112} y={70} width={240} height={260} rx={18} fill={K.card} stroke={K.l2} />
      <g fill={K.l2}>
        <rect x={128} y={83} width={6} height={6} />
        <rect x={139} y={83} width={6} height={6} />
        <rect x={150} y={83} width={6} height={6} />
      </g>
      <text x={336} y={90} fill={K.l3} textAnchor="end">R.0412</text>
      <line x1={112} x2={352} y1={102} y2={102} stroke={K.l2} />
      <text x={128} y={124} fill={K.l3}>WHO</text>
      <rect x={128} y={131} width={208} height={26} rx={8} stroke={K.l2} />
      <text data-a="t1" x={140} y={148} fill={K.ink} style={{ fontSize: 12, letterSpacing: 0 }}>{WHO}</text>
      <text x={128} y={178} fill={K.l3}>DID</text>
      <rect x={128} y={185} width={208} height={28} rx={9} stroke={K.l2} />
      <rect data-a="seg" x={segX(3)} y={188} width={48.5} height={22} rx={6.5} fill={K.ink} />
      {SEG.map((s, i) => (
        <text key={s} data-a={`s${i}`} x={segX(i) + 24.25} y={203} textAnchor="middle" fill={i === 3 ? K.card : K.l3} style={{ letterSpacing: 0 }}>{s}</text>
      ))}
      <text x={128} y={232} fill={K.l3}>WHY</text>
      <rect x={128} y={239} width={208} height={26} rx={8} stroke={K.l2} />
      <text data-a="t2" x={140} y={256} fill={K.ink} style={{ fontSize: 12, letterSpacing: 0 }}>{WHY}</text>
      <line data-a="caret" stroke={K.blue} opacity={0} />
      <rect x={128} y={282} width={150} height={34} rx={10} fill={K.ink} />
      <rect data-a="flash" x={128} y={282} width={150} height={34} rx={10} fill={K.blue} opacity={0} />
      <text x={144} y={303} fill={K.card}>SEAL</text>
      <rect x={246} y={286} width={26} height={26} rx={7} fill={K.blue} />
      <path d="M253.5 299h11m-4.5-4.5 4.5 4.5-4.5 4.5" stroke={K.card} />

      <circle data-a="rip" r={0} stroke={K.blue} opacity={0} />
      <path data-a="cur" transform={`translate(${REST[0]} ${REST[1]})`} d="M0 0v17l4.5-4 3 7 2.6-1.1-3-6.9H13z" fill={K.ink} stroke={K.card} strokeWidth={1.2} />
    </Illus>
  )
}
