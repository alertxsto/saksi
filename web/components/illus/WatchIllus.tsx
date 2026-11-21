'use client'

import { Handles, Illus, K, Rail, eio, pop, ss, useLoop, type IllusProps, type Tick } from './core'

const ROWS = [K.ice, K.blue, K.l2, K.ice, K.blue, K.l2]
const T = [0.6, 1.1, 1.6, 2.1, 3.7, 4.2]
const BAD = 3
const BAD_FG = '#C8281E'
const ry = (r: number) => 145 + 30 * r

const tick: Tick = (t, a) => {
  const reset = 1 - ss(6.6, 7.2, t)
  let f = 0
  for (let r = 1; r < 6; r++) f += eio((t - T[r] + 0.32) / 0.32)
  a('br', { transform: `translate(0 ${30 * f})`, opacity: ss(0.1, 0.4, t) * (1 - ss(5, 5.4, t)) })
  T.forEach((tr, r) => {
    const s = ss(tr - 0.05, tr + 0.1, t) * reset
    a(`r${r}`, { opacity: 0.45 + 0.55 * s })
    if (r !== BAD) a(`n${r}`, { fill: s > 0.5 ? K.ok : K.l2 })
  })
  // tamper: DB row flips red, connector breaks, ALTERED tag
  const m = ss(2.1, 2.25, t) * reset
  const blink = t > 2.1 && t < 2.6 ? (Math.sin((t - 2.1) * 25) > 0 ? 1 : 0.4) : 1
  a('halo', { opacity: 0.35 * m * blink })
  a('pill', { stroke: m > 0.5 ? K.bad : K.l2 })
  a('bsq', { transform: `translate(175 ${ry(BAD)}) scale(${t > 2.1 && reset > 0.5 ? Math.max(0, pop(t - 2.1)) : 0})`, opacity: reset })
  a('bar', { width: 50 - 22 * m })
  a('dash', { opacity: m })
  a('ok3', { opacity: 1 - m })
  a('tag', { opacity: ss(2.25, 2.45, t) * reset, transform: `translate(0 ${4 * (1 - ss(2.25, 2.5, t))})` })
}

function Row({ x, r, side }: { x: number; r: number; side: 'db' | 'ch' }) {
  const y = ry(r)
  const bad = side === 'db' && r === BAD
  return (
    <g>
      <rect data-a={bad ? 'pill' : undefined} x={x} y={y - 10} width={116} height={20} rx={10} stroke={K.l2} fill={K.card} />
      <rect x={x + 6} y={y - 4} width={8} height={8} fill={ROWS[r]} />
      <rect data-a={bad ? 'bar' : undefined} x={x + 22} y={y - 2.5} width={50} height={5} rx={2.5} fill={K.line} />
    </g>
  )
}

export function WatchIllus({ className, framed }: IllusProps) {
  const ref = useLoop(8, tick, 3.2)
  return (
    <Illus
      svgRef={ref}
      className={className}
      framed={framed}
      label="Illustration: database rows are compared against the chain row by row; every row matches except one, which turns red and is marked ALTERED."
    >
      <Rail y={59} x1={143} x2={543} m={[[174, null], [209, K.ice], [254, null], [303, K.l2], [349, null], [387, K.blue], [434, null], [473, K.ice], [520, null]]} />
      <Rail y={353} x1={153} x2={533} m={[[180, null], [213, K.l2], [264, null], [337, null], [383, K.l2], [423, K.ice], [474, null]]} />

      {/* headers */}
      <g stroke={K.l2}>
        <ellipse cx={193} cy={92} rx={15} ry={5} />
        <path d="M178 92v20c0 2.8 6.7 5 15 5s15-2.2 15-5V92M178 102c0 2.8 6.7 5 15 5s15-2.2 15-5" />
        <rect x={430} y={95} width={22} height={12} rx={6} />
        <rect x={443} y={95} width={22} height={12} rx={6} />
      </g>
      <text x={216} y={108} fill={K.l3}>DATABASE</text>
      <text x={474} y={105} fill={K.l3}>CHAIN</text>

      <rect x={153} y={123} width={140} height={204} rx={20} stroke={K.line} />
      <rect x={393} y={123} width={140} height={204} rx={20} stroke={K.line} />
      <Handles x={147} y={117} w={152} h={216} />
      <Handles x={387} y={117} w={152} h={216} />

      {/* connectors */}
      {ROWS.map((_, r) =>
        r === BAD ? (
          <g key={r}>
            <g data-a="ok3">
              <line x1={281} x2={405} y1={ry(r)} y2={ry(r)} stroke={K.line} />
              <rect x={340.5} y={ry(r) - 2.5} width={5} height={5} fill={K.l2} />
            </g>
            <line data-a="dash" x1={281} x2={405} y1={ry(r)} y2={ry(r)} stroke={K.bad} strokeDasharray="5 5" opacity={0} />
          </g>
        ) : (
          <g key={r}>
            <line x1={281} x2={405} y1={ry(r)} y2={ry(r)} stroke={K.line} />
            <rect data-a={`n${r}`} x={340.5} y={ry(r) - 2.5} width={5} height={5} fill={K.l2} />
          </g>
        ),
      )}

      <rect data-a="halo" x={160} y={ry(BAD) - 15} width={126} height={30} rx={15} stroke={K.bad} strokeWidth={6} opacity={0} />
      {ROWS.map((_, r) => (
        <g key={r} data-a={`r${r}`}>
          <Row x={165} r={r} side="db" />
          <Row x={405} r={r} side="ch" />
        </g>
      ))}
      <rect data-a="bsq" x={-4} y={-4} width={8} height={8} fill={K.bad} transform="scale(0)" />

      <g data-a="tag" opacity={0}>
        <rect x={309} y={ry(BAD) - 10} width={68} height={20} rx={6} fill={K.card} stroke={K.bad} />
        <text x={343} y={ry(BAD) + 4} textAnchor="middle" fill={BAD_FG} style={{ fontWeight: 600, letterSpacing: 0 }}>ALTERED</text>
      </g>

      {/* scanning bracket */}
      <g data-a="br" opacity={0}>
        <rect x={157} y={130} width={372} height={30} rx={15} stroke={K.blue} fill={K.blue} fillOpacity={0.04} />
        <rect x={154.5} y={142.5} width={5} height={5} fill={K.blue} />
        <rect x={526.5} y={142.5} width={5} height={5} fill={K.blue} />
      </g>
    </Illus>
  )
}
