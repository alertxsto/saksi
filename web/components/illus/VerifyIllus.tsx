'use client'

import { Handles, Illus, K, Rail, eio, pop, spr, ss, useLoop, type IllusProps, type Tick } from './core'

const GX = 469
const GY = 253
const OK = '#157F3D'
const DOTS: [number, number, string][] = [[143, 123, K.ice], [129, 213, K.blue], [153, 295, K.ice], [401, 131, K.ice], [563, 135, K.ice], [593, 199, K.blue]]
const LINK = 'M317 169C352 169 350 253 377 253'

const value = (t: number) => {
  const jit = 0.016 * Math.sin(2 * Math.PI * 0.7 * t) + 0.008 * Math.sin(2 * Math.PI * 2.3 * t)
  if (t < 1.7) return 0.05 + 0.09 * ss(0.5, 1.6, t) + 0.008 * Math.sin(2 * Math.PI * 1.4 * t) * ss(0.5, 0.8, t)
  if (t < 5.4) return 0.14 + 0.76 * spr(t - 1.7) + jit * ss(2.3, 2.9, t) * (1 - ss(4.9, 5.4, t))
  return 0.9 - 0.85 * ss(5.4, 6.6, t)
}

const tick: Tick = (t, a) => {
  const v = value(t)
  a('ndl', { transform: `rotate(${-90 + 180 * v} ${GX} ${GY})` })
  a('arc', { 'stroke-dasharray': `${Math.max(0.001, v)} 2` })
  const m = ss(2.1, 2.4, t) * (1 - ss(5.4, 5.8, t))
  a('arcok', { 'stroke-dasharray': `${Math.max(0.001, v)} 2`, opacity: m })
  a('zone', { transform: `translate(549 227) scale(${1 + 0.5 * m * Math.max(0, 1 - (t - 2.2) * 2)})` })
  const h = (v - 0.15) / 0.75
  for (let i = 0; i < 15; i++) a(`b${i}`, { opacity: ss(0, 1, (h - i / 15) * 15) })
  // phone: spinner → check
  const c = t > 2.2 ? Math.max(0, pop(t - 2.2)) * (1 - ss(5.4, 5.8, t)) : 0
  a('chk', { transform: `translate(249 169) scale(${c})` })
  a('tick', { 'stroke-dashoffset': 1 - ss(2.3, 2.6, t) })
  a('spin', { transform: `rotate(${t * 120} 249 169)`, opacity: 1 - m })
  a('sq', { fill: m > 0.5 ? OK : K.pend })
  a('s1', { opacity: 1 - m })
  a('s2', { opacity: m })
  a('cap', { opacity: m })
  // record fingerprint travels phone → gauge
  const u = eio((t - 0.5) / 1)
  a('pk', { opacity: t > 0.5 && t < 1.55 ? 1 : 0, 'stroke-dashoffset': 1.12 - 0.88 * u })
  DOTS.forEach((_, i) => a(`d${i}`, { opacity: 0.55 + 0.45 * Math.sin(t * 1.3 + i * 1.9) }))
}

export function VerifyIllus({ className, framed }: IllusProps) {
  const ref = useLoop(7.5, tick, 3.6)
  return (
    <Illus
      svgRef={ref}
      className={className}
      framed={framed}
      label="Illustration: a phone checks a record against the chain; a gauge needle springs to MATCH, a green check appears and the bar meter fills."
    >
      <Rail y={53} x1={363} x2={563} m={[[383, null], [417, K.ice], [459, null], [495, K.ok], [536, null]]} />
      <Rail y={355} x1={103} x2={563} m={[[134, null], [169, K.ice], [220, null], [363, K.l2], [414, null], [449, K.ok], [496, null], [533, K.blue]]} />
      {DOTS.map(([x, y, c], i) => (
        <rect key={i} data-a={`d${i}`} x={x - 3} y={y - 3} width={6} height={6} fill={c} />
      ))}

      {/* phone */}
      <rect x={181} y={71} width={136} height={264} rx={26} fill={K.card} stroke={K.l2} />
      <rect x={193} y={101} width={112} height={220} rx={12} stroke={K.line} />
      <rect x={231} y={84} width={36} height={6} rx={3} fill={K.line} />
      <circle data-a="spin" cx={249} cy={169} r={28} stroke={K.l2} strokeDasharray="3 7" />
      <g data-a="chk" transform="translate(249 169) scale(0)">
        <circle r={30} fill={K.ok} />
        <path data-a="tick" d="M-14 0l8.5 8.5L14-10" stroke={K.card} strokeWidth={3} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} />
      </g>
      <rect x={209} y={217} width={80} height={6} rx={3} fill={K.line} />
      <rect x={209} y={231} width={58} height={6} rx={3} fill={K.line} />
      <rect x={203} y={255} width={92} height={34} rx={10} stroke={K.l2} />
      <rect data-a="sq" x={213} y={268} width={8} height={8} fill={K.pend} />
      <text data-a="s1" x={227} y={276} fill={K.l3} style={{ letterSpacing: 0 }}>CHECKING</text>
      <text data-a="s2" x={227} y={276} fill={K.ink} opacity={0} style={{ fontWeight: 600 }}>MATCH</text>

      {/* link + gauge */}
      <path d={LINK} stroke={K.l2} />
      <path data-a="pk" d={LINK} stroke={K.blue} strokeWidth={2} pathLength={1} strokeDasharray="0.12 1" strokeDashoffset={1} opacity={0} />
      <rect x={314} y={166} width={6} height={6} fill={K.ink} />
      <line x1={363} x2={575} y1={GY} y2={GY} stroke={K.line} />
      <path d="M363 253h9M566 253h9" stroke={K.ink} />
      <path d={`M${GX - 68} ${GY}A68 68 0 0 1 ${GX + 68} ${GY}`} stroke={K.line} />
      <path d={`M${GX - 84} ${GY}A84 84 0 0 1 ${GX + 84} ${GY}`} stroke={K.line} strokeWidth={6} />
      <path data-a="arc" d={`M${GX - 84} ${GY}A84 84 0 0 1 ${GX + 84} ${GY}`} stroke={K.blue} strokeWidth={6} pathLength={1} strokeDasharray="0.05 2" />
      <path data-a="arcok" d={`M${GX - 84} ${GY}A84 84 0 0 1 ${GX + 84} ${GY}`} stroke={OK} strokeWidth={6} pathLength={1} strokeDasharray="0.05 2" opacity={0} />
      {Array.from({ length: 9 }, (_, i) => {
        const r = ((i - 4) * 22.5 * Math.PI) / 180
        const [s, c] = [Math.sin(r), Math.cos(r)]
        const r0 = i === 4 ? 92 : 94
        return <line key={i} x1={GX + r0 * s} y1={GY - r0 * c} x2={GX + 101 * s} y2={GY - 101 * c} stroke={i === 4 ? K.ink : K.l2} />
      })}
      <rect data-a="zone" x={-4.5} y={-4.5} width={9} height={9} fill={K.ok} transform="translate(549 227)" />
      <line data-a="ndl" x1={GX} y1={GY} x2={GX} y2={GY - 62} stroke={K.ink} strokeWidth={2} transform={`rotate(-81 ${GX} ${GY})`} />
      <rect x={GX - 5} y={GY - 5} width={10} height={10} fill={K.ink} />

      {/* 15-cell meter */}
      <rect x={401} y={274} width={136} height={24} rx={8} stroke={K.l2} />
      {Array.from({ length: 15 }, (_, i) => (
        <g key={i}>
          <rect x={406.5 + i * 8.5} y={279} width={6} height={14} rx={1} fill={K.line} />
          <rect data-a={`b${i}`} x={406.5 + i * 8.5} y={279} width={6} height={14} rx={1} fill={K.blue} opacity={0} />
        </g>
      ))}
      <Handles x={401} y={274} w={136} h={24} />
      <text data-a="cap" x={GX} y={322} textAnchor="middle" fill={K.l3} opacity={0}>VERIFIED ON YOUR PHONE</text>
    </Illus>
  )
}
