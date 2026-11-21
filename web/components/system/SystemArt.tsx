import type { CSSProperties, ReactNode } from 'react'
import { shapes } from '@/components/landing/lattice/shapes'
import { blankReceipt, chain, type Cell, delay, fromShape, lens, LENS, padlock, R_STEP, VAULT } from './cells'

// Server-rendered dot-matrix objects for the system screens. One <circle> per lattice cell, drawn on the
// vault slab; entrance (radial, 16 ms/cell) and loops live in globals.css under the SYSTEM block, and
// all of it stops under prefers-reduced-motion, leaving a complete still frame.

function Dots({ cells, enter = true, dx = 0, dy = 0 }: { cells: Cell[]; enter?: boolean; dx?: number; dy?: number }) {
  return cells.map((c) => (
    <circle
      key={`${c.i}.${c.j}`}
      className={enter ? 'sys-dot' : undefined}
      cx={dx + c.i + 0.5}
      cy={dy + c.j + 0.5}
      r={R_STEP * c.s}
      fill={VAULT[c.c]}
      style={enter ? ({ '--d': `${delay(c.i + dx, c.j + dy)}ms` } as CSSProperties) : undefined}
    />
  ))
}

function Frame({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={`block h-auto w-full ${className}`} role="img" aria-label={label}>
      {children}
    </svg>
  )
}

/** 404: an unfilled receipt; a dot lens steps across it one cell at a time and finds nothing. */
export function NothingSealedArt({ className }: { className?: string }) {
  const { ring, glass } = lens()
  return (
    <Frame label="An empty receipt under a magnifying lens" className={className}>
      <Dots cells={blankReceipt()} />
      <g className="sys-lens">
        {/* the lens is solid: its ring and glass knock out the receipt dots underneath, so the glass shows nothing */}
        {[...ring.map((c) => [c.i, c.j] as const), ...glass].map(([i, j]) => (
          <rect key={`k${i}.${j}`} x={LENS.cx + i} y={LENS.cy + j} width={1.02} height={1.02} fill="var(--color-vault)" />
        ))}
        <Dots cells={ring} dx={LENS.cx} dy={LENS.cy} />
      </g>
    </Frame>
  )
}

/** Error: this server's links, a broken bridge with packets travelling across it, and the chain's ice link. `idle` (offline) stills the packets. */
export function ReconnectArt({ className = '', idle = false }: { className?: string; idle?: boolean }) {
  const { links, packets, chainLink } = chain()
  return (
    <Frame label={idle ? 'A chain link, disconnected' : 'A chain link reconnecting'} className={`${idle ? 'sys-idle' : ''} ${className}`}>
      <Dots cells={links} />
      {packets.map((c) => (
        <g key={`p${c.i}.${c.j}`} className="sys-packet" style={{ '--k': c.k } as CSSProperties}>
          <Dots cells={[c]} />
        </g>
      ))}
      <g className="sys-chain">
        <Dots cells={chainLink} />
      </g>
    </Frame>
  )
}

/** Static lattice objects for the OG card: no entrance animation; `viewBox` crops to the object's bounds. */
export function StillArt({ cells, label, viewBox = '0 0 40 40', className = '' }: { cells: Cell[]; label?: string; viewBox?: string; className?: string }) {
  return (
    <svg viewBox={viewBox} className={`block ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <Dots cells={cells} enter={false} />
    </svg>
  )
}

export const ogCells = { padlock, receipt: () => fromShape(shapes.receipt()), chain: () => fromShape(shapes.block(0)) }
