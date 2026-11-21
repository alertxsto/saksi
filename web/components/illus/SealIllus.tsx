'use client'

import { useId } from 'react'
import { Handles, Illus, K, Rail, eio, ss, useLoop, type IllusProps, type Tick } from './core'

const CX = 171
const CY = 196
// ridges: [r, left leg, right leg, dash pattern on pathLength 100]
const RIDGES: [number, number, number, string][] = [
  [5, 4, 2, ''], [11, 10, 6, '62 7 100'], [17, 16, 14, ''], [23, 22, 18, '30 6 100'], [29, 30, 24, ''],
  [35, 34, 32, '58 6 100'], [41, 40, 38, '22 5 100'], [47, 44, 46, ''],
]
const ridge = (r: number, l: number, rr: number) =>
  `M${CX - r - l * 0.3} ${CY + l}Q${CX - r} ${CY + l * 0.45} ${CX - r} ${CY}A${r} ${(r * 1.15).toFixed(1)} 0 0 1 ${CX + r} ${CY}Q${CX + r} ${CY + rr * 0.45} ${CX + r + rr * 0.3} ${CY + rr}`
const Print = ({ stroke, o = 1 }: { stroke: string; o?: number }) => (
  <g stroke={stroke} strokeOpacity={o}>
    {RIDGES.map(([r, l, rr, d]) => (
      <path key={r} d={ridge(r, l, rr)} pathLength={100} strokeDasharray={d || undefined} />
    ))}
  </g>
)
// connectors: fingerprint → chip
const Y0 = [176, 210, 244]
const Y1 = [189, 210, 231]
const line = (i: number) => `M219 ${Y0[i]}C330 ${Y0[i]} 340 ${Y1[i]} 443 ${Y1[i]}`
const at = (i: number, u: number) => {
  const v = 1 - u
  return [v * v * v * 219 + 3 * v * v * u * 330 + 3 * v * u * u * 340 + u * u * u * 443, (v * v * v + 3 * v * v * u) * Y0[i] + (3 * v * u * u + u * u * u) * Y1[i]]
}
const ARR = [2.9, 3.25, 3.6]
const PK = [K.blue, K.ice, K.blue]
const fmt = (n: number) => n.toLocaleString('en-US')

const tick: Tick = (t, a, k) => {
  const sy = 136 + 116 * eio((t - 0.2) / 1.2)
  const back = ss(5.8, 6.6, t)
  a('scan', { y1: sy, y2: sy, opacity: ss(0.1, 0.25, t) * (1 - ss(1.4, 1.7, t)) })
  a('clip', { height: Math.max(0, sy - 136) * (1 - back) })
  let bump = 0
  ARR.forEach((ta, i) => {
    const u = clamp01((t - ta + 1.6) / 1.6)
    const [x, y] = at(i, eio(u))
    const s = 1 - 0.45 * ss(0.8, 1, u)
    a(`p${i}`, { transform: `translate(${x} ${y}) scale(${s})`, opacity: u > 0 && u < 1 ? 1 - ss(0.94, 1, u) : 0 })
    const tau = t - ta
    if (tau > 0) bump += Math.min(1, tau * 14) * Math.exp(-5 * tau)
    // ambient data dots
    for (let j = 0; j < 2; j++) {
      const v = ((t + i * 0.9 + j * 1.75) / 3.5) % 1
      const [dx, dy] = at(i, v)
      a(`d${i}${j}`, { x: dx - 2, y: dy - 2, opacity: ss(0, 0.1, v) * (1 - ss(0.85, 0.95, v)) })
    }
  })
  a('chip', { transform: `translate(488 208) scale(${1 + 0.06 * bump}) translate(-488 -208)` })
  a('ring', { opacity: 0.5 * bump, transform: `translate(488 208) scale(${1.05 + 0.12 * (1 - bump)}) translate(-488 -208)` })
  // sealed: out-wire pulse → block fills, counter ticks
  const w = eio((t - 3.75) / 0.4)
  a('wp', { x: 543 + 14 * w, opacity: t > 3.75 && t < 4.2 ? 1 : 0 })
  const done = t > 4.15
  a('blk', { opacity: (done ? ss(4.15, 4.3, t) : 0) * (1 - back) })
  const lit = (k % 6) + 3 + (done ? 1 : 0)
  for (let i = 0; i < 8; i++) a(`c${i}`, { fill: i < lit % 9 ? K.ice : K.line })
  a('n', { text: `#${fmt(12181964 + k + (done ? 1 : 0))}` })
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export function SealIllus({ className, framed }: IllusProps) {
  const ref = useLoop(7, tick, 4.6)
  const id = useId().replace(/[^\w-]/g, '')
  return (
    <Illus
      svgRef={ref}
      className={className}
      framed={framed}
      label="Illustration: a fingerprint is scanned, three data packets travel along curved lines into a blue chain chip that pulses, and the block counter ticks up."
    >
      <Rail y={50} x1={173} x2={483} m={[[198, null], [225, K.l2], [270, null], [303, K.ice], [339, K.blue], [382, null], [413, K.l2], [460, null]]} />
      <Rail y={350} x1={183} x2={473} m={[[201, K.ice], [244, null], [279, K.l2], [326, null], [353, K.blue], [400, null], [433, K.ok]]} />

      {/* fingerprint */}
      <Print stroke={K.l2} />
      <clipPath id={id}>
        <rect data-a="clip" x={110} y={136} width={122} height={0} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <Print stroke={K.ink} o={0.8} />
      </g>
      <path d={ridge(29, 30, 24)} pathLength={100} strokeDasharray="0 18 46 100" stroke={K.ice} strokeWidth={2.5} />
      <line data-a="scan" x1={111} x2={231} y1={136} y2={136} stroke={K.blue} opacity={0} />
      <Handles x={113} y={130} w={116} h={126} />

      {/* connectors + packets */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <path d={line(i)} stroke={K.l2} />
          <rect data-a={`d${i}0`} width={4} height={4} fill={K.l2} opacity={0} />
          <rect data-a={`d${i}1`} width={4} height={4} fill={K.l2} opacity={0} />
          <rect data-a={`p${i}`} x={-5} y={-5} width={10} height={10} fill={PK[i]} opacity={0} />
        </g>
      ))}

      {/* chain chip */}
      <line x1={543} x2={561} y1={208} y2={208} stroke={K.l2} />
      <rect data-a="wp" x={543} y={205.5} width={5} height={5} fill={K.blue} opacity={0} />
      <rect x={561} y={190} width={36} height={36} rx={9} stroke={K.line} fill={K.card} />
      <rect data-a="blk" x={561} y={190} width={36} height={36} rx={9} fill={K.blue} opacity={0} />
      <rect data-a="ring" x={443} y={163} width={90} height={90} rx={20} stroke={K.blue} opacity={0} />
      <g data-a="chip">
        <g fill={K.l2}>
          {[462, 483, 504].map((x) => (
            <g key={x}>
              <rect x={x - 3} y={153} width={6} height={10} rx={2} />
              <rect x={x - 3} y={253} width={6} height={10} rx={2} />
            </g>
          ))}
          {Y1.map((y) => (
            <rect key={y} x={533} y={y - 3} width={10} height={6} rx={2} />
          ))}
        </g>
        <rect x={443} y={163} width={90} height={90} rx={20} fill={K.blue} />
        <rect x={461} y={200} width={30} height={16} rx={8} stroke={K.card} strokeWidth={2.5} />
        <rect x={485} y={200} width={30} height={16} rx={8} stroke={K.card} strokeWidth={2.5} />
      </g>
      <Handles x={437} y={157} w={102} h={102} />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} data-a={`c${i}`} x={452 + i * 9.5} y={277} width={5} height={5} fill={i < 3 ? K.ice : K.line} />
      ))}
      <text data-a="n" x={488} y={302} textAnchor="middle" fill={K.l3}>#12,181,964</text>
    </Illus>
  )
}
