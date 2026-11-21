'use client'

import { Illus, K, Rail, pop, spr, ss, useLoop, type IllusProps, type Tick } from './core'

const CX = 323
const CY = 214
const R = 100
const BAD_FG = '#C8281E'
const OK = '#157F3D'
const p = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)]
}
const arc = (r: number, d0: number, d1: number) => {
  const [x0, y0] = p(r, d0)
  const [x1, y1] = p(r, d1)
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${d1 - d0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`
}
const ang = (h: number) => -135 + 3.75 * h
const CELLS = Array.from({ length: 12 }, (_, i) => arc(R, ang(6 * i) + 1.6, ang(6 * i + 6) - 1.6))
const LABELS: [number, string][] = [[0, '0H'], [24, '24H'], [48, '48H'], [72, '72H']]

const tick: Tick = (t, a, k) => {
  const late = k % 2 === 0
  const H = late ? 82 : 58
  const run = late ? ss(0.6, 5.6, t) : ss(0.6, 4.4, t)
  const h = t < 7.8 ? H * run : Math.max(-5, H * (1 - spr(t - 7.8)))
  const filed = !late && t > 4.4 && t < 7.8
  const over = late && h > 72
  a('hand', { transform: `rotate(${ang(h)} ${CX} ${CY})` })
  const [kx, ky] = p(R, ang(Math.max(0, Math.min(h, 72))))
  const kp = filed ? 1 + 0.35 * Math.max(0, 1 - (t - 4.4) * 2.5) : 1
  a('knob', { transform: `translate(${kx} ${ky}) scale(${kp})`, fill: filed ? K.ok : over ? K.bad : K.pend })
  for (let i = 0; i < 12; i++) a(`c${i}`, { opacity: ss(0, 1, (h - 6 * i) / 6) })
  a('late', { 'stroke-dasharray': `${Math.max(0.001, (h - 72) / 10)} 2`, opacity: over ? 1 : 0 })
  const pulse = over ? 1 + 0.4 * Math.max(0, Math.sin((t - 4.9) * 9)) * (1 - ss(5.6, 6.6, t)) : 1
  a('dl', { transform: `translate(${p(128, 135).join(' ')}) scale(${pulse})` })
  // readout
  a('sq', { fill: filed ? OK : over ? K.bad : K.pend })
  a('ro', {
    text: filed ? 'FILED 58H' : over ? `LATE +${Math.ceil(h - 72)}H` : `T+${String(Math.max(0, Math.floor(h))).padStart(2, '0')}H`,
    fill: over ? BAD_FG : K.ink,
  })
  a('stamp', { transform: `translate(${CX} 168) scale(${filed ? Math.max(0, pop(t - 4.5)) : 0})` })
}

export function BreachIllus({ className, framed }: IllusProps) {
  const ref = useLoop(9, tick, 6.4, 1)
  return (
    <Illus
      svgRef={ref}
      className={className}
      framed={framed}
      label="Illustration: a 72-hour breach clock; the hand sweeps from 0 toward 72 hours while cells fill amber. On time the report is filed; past 72 hours the overrun turns red."
    >
      <Rail y={53} x1={113} x2={253} m={[[142, null], [163, K.ice], [210, null], [239, K.l2]]} />
      <Rail y={53} x1={393} x2={533} m={[[407, K.l2], [450, null], [483, K.pend], [515, null]]} />

      {/* dial */}
      <path d={arc(80, -128, 128)} stroke={K.line} />
      {CELLS.map((d, i) => (
        <g key={i}>
          <path d={d} stroke={K.line} strokeWidth={7} strokeLinecap="butt" />
          <path data-a={`c${i}`} d={d} stroke={K.pend} strokeWidth={7} strokeLinecap="butt" opacity={0} />
        </g>
      ))}
      <path data-a="late" d={arc(R, 136.5, 172.5)} stroke={K.bad} strokeWidth={7} strokeLinecap="butt" pathLength={1} strokeDasharray="0.001 2" opacity={0} />
      {Array.from({ length: 13 }, (_, i) => {
        const major = i % 4 === 0
        const [x0, y0] = p(major ? 110 : 109, ang(6 * i))
        const [x1, y1] = p(major ? 121 : 114, ang(6 * i))
        return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={major ? K.ink : K.l2} />
      })}
      {LABELS.map(([h, s]) => {
        const [sx, sy] = p(128, ang(h))
        const [tx, ty] = p(150, ang(h))
        return (
          <g key={s}>
            {h < 72 && <rect x={sx - 3} y={sy - 3} width={6} height={6} fill={K.l2} />}
            <text x={tx} y={ty + 4} textAnchor="middle" fill={h === 72 ? BAD_FG : K.l3} style={{ fontSize: 12 }}>{s}</text>
          </g>
        )
      })}
      <rect data-a="dl" x={-3.5} y={-3.5} width={7} height={7} fill={K.bad} transform={`translate(${p(128, 135).join(' ')})`} />

      <g data-a="stamp" transform={`translate(${CX} 168) scale(0)`}>
        <circle r={13} fill={K.ok} />
        <path d="M-6 0.5l4 4 8-8.5" stroke={K.card} strokeWidth={2} />
      </g>
      <line data-a="hand" x1={CX} y1={CY} x2={CX} y2={CY - 74} stroke={K.ink} strokeWidth={2} transform={`rotate(-135 ${CX} ${CY})`} />
      <circle cx={CX} cy={CY} r={7} fill={K.ink} />
      <circle cx={CX} cy={CY} r={2.5} fill={K.card} />
      <rect data-a="knob" x={-6.5} y={-6.5} width={13} height={13} fill={K.pend} stroke={K.ink} transform={`translate(${p(R, -135).join(' ')})`} />

      {/* readout */}
      <rect x={277} y={294} width={92} height={26} rx={9} fill={K.card} stroke={K.l2} />
      <rect data-a="sq" x={287} y={303} width={8} height={8} fill={K.pend} />
      <text data-a="ro" x={301} y={311} fill={K.ink} style={{ letterSpacing: 0 }}>T+00H</text>
    </Illus>
  )
}
