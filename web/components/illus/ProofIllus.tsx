'use client'

import { useId } from 'react'
import { Handles, Illus, K, Rail, eio, hash, pop, ss, useLoop, type IllusProps, type Tick } from './core'

const HASH = '0x3fa2…9c1d'
const HEX = '0123456789abcdef'
const OK = '#157F3D'
const hx = (i: number) => 206 + i * 9.2
const NODES = [120, 199, 278]
const NODE_C = [K.ice, K.ok, K.ice]
const teeth = (y: number, d: number, rev: boolean) => {
  const xs = Array.from({ length: 17 }, (_, i) => 190 + i * 10)
  if (rev) xs.reverse()
  return xs.map((x, i) => `L${x} ${i % 2 ? y + d : y}`).join('')
}
const RECEIPT = `M190 80${teeth(80, -7, false)}V326${teeth(326, 7, true)}Z`
// lens path keyframes
const KF: [number, number, number, number][] = [
  [0.3, 1.6, 246, 214],
  [1.6, 2.1, 198, 286],
  [2.1, 4.0, 300, 286],
  [6.8, 7.8, 330, 150],
]

const tick: Tick = (t, a) => {
  let x = 330
  let y = 150
  for (const [t0, t1, nx, ny] of KF) {
    const e = eio((t - t0) / (t1 - t0))
    x += (nx - x) * e
    y += (ny - y) * e
  }
  a('lens', { transform: `translate(${x} ${y})` })
  a('lc', { cx: x, cy: y })
  a('mag', { transform: `translate(${x} ${y}) scale(1.6) translate(${-x} ${-y})` })
  const back = ss(6.9, 7.5, t)
  for (let i = 0; i < HASH.length; i++) {
    const cx = hx(i) + 4
    const done = t > 2 && x > cx - 8 && t < 7.8 && back < (HASH.length - i) / HASH.length
    const near = Math.abs(x - cx) < 44 && y > 260
    const g = HEX[Math.floor(hash(i * 13 + Math.floor(t * (near ? 24 : 5))) * 16)]
    a(`h${i}`, { text: done ? HASH[i] : g, fill: done ? K.ink : near ? K.l3 : K.line })
  }
  const settled = t > 4 && t < 7
  a('chk', { transform: `translate(318 286) scale(${settled ? Math.max(0, pop(t - 4)) : 0})` })
  NODES.forEach((ny, i) => {
    const on = t > 4.3 + i * 0.25 && t < 7
    a(`w${i}`, { d: `M${x + 48} ${y}C${x + 100} ${y} 420 ${ny} 470 ${ny}`, stroke: on ? K.l2 : K.line })
    a(`n${i}`, { fill: on ? NODE_C[i] : K.line, transform: `translate(484 ${ny}) scale(${on ? 0.8 + 0.2 * Math.max(0, pop(t - 4.3 - i * 0.25)) : 0.8})` })
  })
}

export function ProofIllus({ className, framed }: IllusProps) {
  const ref = useLoop(8, tick, 5.2)
  const id = useId().replace(/[^\w-]/g, '')
  return (
    <Illus
      svgRef={ref}
      className={className}
      framed={framed}
      label="Illustration: a magnifier slides over a ledger receipt; the fingerprint characters scramble and settle, a check appears and three independent verifiers confirm."
    >
      <Rail y={355} x1={123} x2={563} m={[[154, null], [189, K.l2], [232, null], [265, K.ice], [434, null], [469, K.blue], [516, null], [543, K.ok]]} />
      <rect x={150} y={120} width={6} height={6} fill={K.ice} />
      <rect x={160} y={280} width={5} height={5} fill={K.ice} />
      <rect x={560} y={336} width={5} height={5} fill={K.ice} />

      {/* receipt */}
      <g id={`${id}c`}>
        <path d={RECEIPT} fill={K.card} stroke={K.l2} />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <rect x={206} y={101.5 + i * 28} width={i % 2 ? 26 : 34} height={5} rx={2.5} fill={K.line} />
            <line x1={256} x2={300} y1={104 + i * 28} y2={104 + i * 28} stroke={K.line} strokeWidth={2.5} strokeDasharray="0 6" />
            <rect x={306} y={101.5 + i * 28} width={28} height={5} rx={2.5} fill={K.l2} />
          </g>
        ))}
        <line x1={206} x2={334} y1={240} y2={240} stroke={K.line} strokeDasharray="4 4" />
        <text x={206} y={264} fill={K.l3}>FINGERPRINT</text>
        {HASH.split('').map((c, i) => (
          <text key={i} data-a={`h${i}`} x={hx(i)} y={292} fill={K.line} style={{ fontSize: 14, letterSpacing: 0 }}>{c}</text>
        ))}
        <path data-a="chk" d="M-6 0l4 4 8-9" stroke={OK} strokeWidth={2} transform="translate(318 286) scale(0)" />
        <rect x={206} y={310} width={50} height={6} rx={3} fill={K.l2} />
      </g>
      <Handles x={184} y={66} w={172} h={274} />

      {/* verifiers */}
      {NODES.map((ny, i) => (
        <g key={ny}>
          <path data-a={`w${i}`} d="" stroke={K.line} />
          <rect x={470} y={ny - 14} width={28} height={28} rx={8} fill={K.card} stroke={K.l2} />
          <rect data-a={`n${i}`} x={-7} y={-7} width={14} height={14} fill={K.line} transform={`translate(484 ${ny}) scale(.8)`} />
          <rect x={510} y={ny - 2.5} width={i === 1 ? 28 : 40} height={5} rx={2.5} fill={K.line} />
        </g>
      ))}

      {/* magnifier */}
      <clipPath id={`${id}l`}>
        <circle data-a="lc" r={41} cx={330} cy={150} />
      </clipPath>
      <g clipPath={`url(#${id}l)`}>
        <rect x={0} y={0} width={640} height={400} fill={K.card} />
        <use data-a="mag" href={`#${id}c`} />
        <rect x={0} y={0} width={640} height={400} fill={K.blue} opacity={0.035} />
      </g>
      <g data-a="lens" transform="translate(330 150)">
        <circle r={41} stroke={K.line} />
        <circle r={48} stroke={K.ink} strokeWidth={2} />
        <line x1={40} y1={40} x2={78} y2={78} stroke={K.ink} strokeWidth={9} />
        <path d="M33.5 40.5l7-7 6 6-7 7z" fill={K.l2} />
      </g>
    </Illus>
  )
}
