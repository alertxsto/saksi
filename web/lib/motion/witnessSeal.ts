// Witness Seal (riset-ui/09-motion-teardown.md §1.2): the hairline Saksi outline is rasterised into
// 6 px grid cells. The cursor path is *witnessed* — cells near the pointer bead into dots, in order.
// When the cursor rests (650 ms) or leaves, an ice pulse re-seals the cells in witness order and a
// blue block is stamped at the last one with a real SHA-256 of the gesture. Idle heartbeat: every 6 s
// one ice dot rides a contour of the outline. Canvas2D, DPR ≤ 2, rAF only while something moves.

import { clamp01, easeOutCubic } from './tokens'

const C = 6 // cell size, CSS px
const R = 38 // witness radius
const LENS = 14 // bright core radius
const MAX_WITNESSED = 220
const REST_MS = 650
const SEAL_CELL_MS = 260
const SEAL_FADE_MS = 200
const HEARTBEAT_MS = 6000
const SIZES = [2.5, 3.5, 3] as const

const VAULT = '#24211D'
const DOT1 = '#6E6457'
const DOT2 = '#8A7F70'
const LENS_INK = '#A39B8F' // vault-ink-2: the bright core that follows the cursor
const ICE = '#9BD9E0'
const BLUE = '#2A2AE8'
const ICE_RGB = [155, 217, 224]
const DOT1_RGB = [110, 100, 87]

type Seg = { ax: number; ay: number; bx: number; by: number }
type Cell = {
  id: number
  col: number
  row: number
  gx: number // glyph anchor (outline midpoint pulled toward the cell centre)
  gy: number
  segs: Seg[]
  shape: 0 | 1 | 2
  state: 0 | 1 | 2 // idle | witnessed | sealing
  t0: number
}
type Stamp = { x: number; y: number; t0: number; size: number; life: number; ring: boolean }

export type WitnessSeal = { setInView(on: boolean): void; destroy(): void }

const key = (c: number, r: number) => c * 4096 + r
const hash2 = (c: number, r: number) => {
  let h = (c * 374761393 + r * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return (h ^ (h >>> 16)) >>> 0
}
const mix = (t: number) =>
  `rgb(${ICE_RGB.map((v, i) => Math.round(v + (DOT1_RGB[i] - v) * t)).join(',')})`

async function gestureHash(ids: number[]): Promise<string> {
  const text = ids.join(',')
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    // insecure origin (no crypto.subtle): FNV-1a so the label is still derived from the gesture
    let h = 0x811c9dc5
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
    return (h >>> 0).toString(16).padStart(8, '0').repeat(2)
  }
}

export function createWitnessSeal({
  wrap,
  svg,
  canvas,
  label,
  interactive,
}: {
  wrap: HTMLElement
  svg: SVGSVGElement
  canvas: HTMLCanvasElement
  label: HTMLElement
  /** pointer witnessing (fine pointer + hover only); heartbeat always runs */
  interactive: boolean
}): WitnessSeal | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  let cells = new Map<number, Cell>()
  let contours: Cell[][] = []
  let witnessed: Cell[] = []
  let sealing: Array<{ cell: Cell; at: number }> = []
  let stamps: Stamp[] = []
  let px = -1e4
  let py = -1e4
  let pointerIn = false
  let lastActivity = 0
  let inView = false
  let raf = 0
  let restTimer = 0
  let hb: { cells: Cell[]; t0: number; speed: number } | null = null
  let hbIndex = 0
  let labelTimer = 0
  let destroyed = false

  // ---- rasterise the SVG outline into cells -------------------------------------------------
  function rasterise() {
    const wr = wrap.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.max(1, Math.round(wr.width * dpr))
    canvas.height = Math.max(1, Math.round(wr.height * dpr))
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

    const next = new Map<number, Cell>()
    const nextContours: Cell[][] = []
    svg.querySelectorAll('path').forEach((path) => {
      const m = path.getScreenCTM()
      if (!m) return
      const scale = Math.hypot(m.a, m.b)
      const L = path.getTotalLength()
      const n = Math.max(2, Math.ceil(L * scale))
      const order: Cell[] = []
      let prevX = 0
      let prevY = 0
      let prevCell: Cell | null = null
      let seg: Seg | null = null
      for (let i = 0; i <= n; i++) {
        const p = path.getPointAtLength((L * i) / n)
        const x = m.a * p.x + m.c * p.y + m.e - wr.left
        const y = m.b * p.x + m.d * p.y + m.f - wr.top
        const col = Math.floor(x / C)
        const row = Math.floor(y / C)
        const k = key(col, row)
        let cell = next.get(k)
        if (!cell) {
          cell = { id: k, col, row, gx: 0, gy: 0, segs: [], shape: (hash2(col, row) % 3) as 0 | 1 | 2, state: 0, t0: 0 }
          next.set(k, cell)
        }
        if (cell === prevCell && seg) {
          seg.bx = x
          seg.by = y
        } else {
          seg = i === 0 ? { ax: x, ay: y, bx: x, by: y } : { ax: prevX, ay: prevY, bx: x, by: y }
          cell.segs.push(seg)
          if (order[order.length - 1] !== cell) order.push(cell)
        }
        prevCell = cell
        prevX = x
        prevY = y
      }
      if (order.length > 1) nextContours.push(order)
    })
    next.forEach((cell) => {
      let sx = 0
      let sy = 0
      for (const s of cell.segs) {
        sx += (s.ax + s.bx) / 2
        sy += (s.ay + s.by) / 2
      }
      const cx = cell.col * C + C / 2
      const cy = cell.row * C + C / 2
      cell.gx = sx / cell.segs.length + (cx - sx / cell.segs.length) * 0.7
      cell.gy = sy / cell.segs.length + (cy - sy / cell.segs.length) * 0.7
    })
    cells = next
    contours = nextContours
    witnessed = []
    sealing = []
    stamps = []
    hb = null
    ctx!.clearRect(0, 0, wr.width, wr.height)
  }

  // ---- drawing helpers -------------------------------------------------------------------------
  function erase(c: Cell) {
    ctx!.fillStyle = VAULT
    ctx!.fillRect(c.col * C, c.row * C, C, C)
  }
  function strokeSegs(c: Cell, f: number, color: string) {
    if (f <= 0.01) return
    ctx!.strokeStyle = color
    ctx!.lineWidth = 1
    ctx!.beginPath()
    for (const s of c.segs) {
      const mx = (s.ax + s.bx) / 2
      const my = (s.ay + s.by) / 2
      const hx = ((s.bx - s.ax) / 2) * f
      const hy = ((s.by - s.ay) / 2) * f
      ctx!.moveTo(mx - hx, my - hy)
      ctx!.lineTo(mx + hx, my + hy)
    }
    ctx!.stroke()
  }
  function glyph(x: number, y: number, shape: number, size: number, color: string, alpha = 1) {
    if (size <= 0.15) return
    ctx!.globalAlpha = alpha
    ctx!.fillStyle = color
    if (shape === 1) {
      ctx!.fillRect(x - size / 2, y - size / 2, size, size)
    } else {
      ctx!.beginPath()
      ctx!.arc(x, y, (shape === 2 ? size * 0.75 : size) / 2, 0, Math.PI * 2)
      ctx!.fill()
    }
    ctx!.globalAlpha = 1
  }

  // ---- seal pass ------------------------------------------------------------------------------
  function seal() {
    clearTimeout(restTimer)
    if (!witnessed.length) return
    const now = performance.now()
    const list = witnessed
    witnessed = []
    const step = Math.min(9, 1400 / list.length)
    list.forEach((cell, i) => {
      cell.state = 2
      sealing.push({ cell, at: now + i * step })
    })
    const last = list[list.length - 1]
    const stampAt = now + (list.length - 1) * step + SEAL_CELL_MS
    stamps.push({ x: last.col * C + C / 2, y: last.row * C + C / 2, t0: stampAt, size: 6, life: 3000, ring: true })
    const ids = list.map((c) => c.id)
    void gestureHash(ids).then((hex) => {
      if (destroyed) return
      const delay = Math.max(0, stampAt - performance.now())
      clearTimeout(labelTimer)
      labelTimer = window.setTimeout(() => {
        const d = new Date()
        const hh = [d.getHours(), d.getMinutes(), d.getSeconds()].map((v) => String(v).padStart(2, '0')).join(':')
        label.textContent = `#${hex.slice(0, 4)}…${hex.slice(-2)} · sealed ${hh}`
        const w = wrap.clientWidth
        const x = last.col * C + C / 2
        const left = x + 14 + 190 > w ? x - 14 - 190 : x + 14
        label.style.left = `${Math.max(0, left)}px`
        label.style.top = `${Math.max(0, last.row * C - 4)}px`
        label.removeAttribute('data-show')
        void label.offsetWidth // restart the CSS animation
        label.setAttribute('data-show', '')
      }, delay)
    })
    kick()
  }

  // ---- pointer --------------------------------------------------------------------------------
  function onMove(e: PointerEvent) {
    if (e.pointerType === 'touch') return
    const wr = wrap.getBoundingClientRect()
    px = e.clientX - wr.left
    py = e.clientY - wr.top
    pointerIn = true
    const now = performance.now()
    lastActivity = now
    const c0 = Math.floor((px - R) / C)
    const c1 = Math.floor((px + R) / C)
    const r0 = Math.floor((py - R) / C)
    const r1 = Math.floor((py + R) / C)
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const cell = cells.get(key(c, r))
        if (!cell || cell.state !== 0) continue
        if (Math.hypot(cell.gx - px, cell.gy - py) > R) continue
        cell.state = 1
        cell.t0 = now
        witnessed.push(cell)
      }
    }
    while (witnessed.length > MAX_WITNESSED) {
      const old = witnessed.shift()!
      old.state = 2
      sealing.push({ cell: old, at: now })
    }
    clearTimeout(restTimer)
    restTimer = window.setTimeout(seal, REST_MS)
    kick()
  }
  function onLeave() {
    pointerIn = false
    px = py = -1e4
    seal()
  }

  // ---- heartbeat ------------------------------------------------------------------------------
  function beat() {
    const now = performance.now()
    if (!inView || hb || !contours.length || now - lastActivity < 3000 || witnessed.length) return
    // the longest few contours read best; cycle through them
    const pool = contours.filter((c) => c.length > 24)
    if (!pool.length) return
    const cellsOnPath = pool[hbIndex++ % pool.length]
    const lap = Math.min(2.6, Math.max(1.8, cellsOnPath.length / 54))
    hb = { cells: cellsOnPath, t0: now, speed: cellsOnPath.length / lap / 1000 }
    kick()
  }
  const hbTimer = window.setInterval(beat, HEARTBEAT_MS)

  // ---- frame ----------------------------------------------------------------------------------
  function frame() {
    raf = 0
    const now = performance.now()
    const w = wrap.clientWidth
    const h = wrap.clientHeight
    ctx!.clearRect(0, 0, w, h)

    for (const cell of witnessed) {
      const k = easeOutCubic(clamp01((now - cell.t0) / 180))
      const near = pointerIn && Math.hypot(cell.gx - px, cell.gy - py) < LENS
      erase(cell)
      strokeSegs(cell, 1 - k, DOT1)
      glyph(cell.gx, cell.gy, cell.shape, (SIZES[cell.shape] + (near ? 1 : 0)) * k, near ? LENS_INK : DOT2)
    }

    sealing = sealing.filter(({ cell, at }) => {
      const dt = now - at
      const base = SIZES[cell.shape]
      erase(cell)
      if (dt < 0) {
        glyph(cell.gx, cell.gy, cell.shape, base, DOT2)
      } else if (dt < 90) {
        glyph(cell.gx, cell.gy, cell.shape, base + 1, ICE)
      } else if (dt < SEAL_CELL_MS) {
        const n = (dt - 90) / (SEAL_CELL_MS - 90)
        const f = 1 + 2.4 * (n - 1) ** 3 + 1.6 * (n - 1) ** 2
        strokeSegs(cell, f, ICE)
        glyph(cell.gx, cell.gy, cell.shape, (base + 1) * (1 - n) ** 3, ICE)
      } else if (dt < SEAL_CELL_MS + SEAL_FADE_MS) {
        strokeSegs(cell, 1, mix((dt - SEAL_CELL_MS) / SEAL_FADE_MS))
      } else {
        cell.state = 0
        // repaint once more so the SVG hairline underneath shows through cleanly next frame
        ctx!.clearRect(cell.col * C, cell.row * C, C, C)
        return false
      }
      return true
    })

    if (hb) {
      const head = (now - hb.t0) * hb.speed
      const hi = Math.floor(head)
      for (let i = 0; i < 14; i++) {
        const cell = hb.cells[hi - i]
        if (!cell || cell.state !== 0) continue
        erase(cell)
        strokeSegs(cell, 0.25 + 0.75 * (i / 14), DOT1)
        glyph(cell.gx, cell.gy, 0, 2.5 - 1.5 * (i / 14), ICE, (1 - i / 14) ** 2)
      }
      if (hi - 14 >= hb.cells.length) {
        const end = hb.cells[hb.cells.length - 1]
        stamps.push({ x: end.gx, y: end.gy, t0: now, size: 4, life: 600, ring: false })
        hb = null
      }
    }

    stamps = stamps.filter((s) => {
      const t = now - s.t0
      if (t < 0) return true
      if (t > s.life) return false
      const k = clamp01(t / 220)
      const scale = k < 1 ? 1 + 3.4 * (k - 1) ** 3 + 2.4 * (k - 1) ** 2 : 1 // 0 → ~1.25 → 1
      const alpha = s.ring ? (t < s.life - 400 ? 1 : (s.life - t) / 400) : 1 - clamp01((t - s.life + 200) / 200)
      const size = s.size * Math.max(0, scale)
      ctx!.globalAlpha = alpha
      ctx!.fillStyle = BLUE
      ctx!.fillRect(s.x - size / 2, s.y - size / 2, size, size)
      if (s.ring && t < 500) {
        const rt = t / 500
        ctx!.globalAlpha = 1 - rt
        ctx!.strokeStyle = ICE
        ctx!.lineWidth = 1
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, 3 + 15 * easeOutCubic(rt), 0, Math.PI * 2)
        ctx!.stroke()
      }
      ctx!.globalAlpha = 1
      return true
    })

    const busy = witnessed.length > 0 || sealing.length > 0 || stamps.length > 0 || hb !== null
    if (busy && inView) raf = requestAnimationFrame(frame)
    if (!busy) ctx!.clearRect(0, 0, w, h)
  }
  function kick() {
    if (!raf && inView && !destroyed) raf = requestAnimationFrame(frame)
  }

  // ---- lifecycle ------------------------------------------------------------------------------
  rasterise()
  let resizeTimer = 0
  let firstResize = true
  const ro = new ResizeObserver(() => {
    if (firstResize) {
      firstResize = false
      return
    }
    clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(rasterise, 150)
  })
  ro.observe(wrap)
  if (interactive) {
    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerleave', onLeave)
  }

  return {
    setInView(on) {
      inView = on
      if (on) kick()
      else if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    },
    destroy() {
      destroyed = true
      cancelAnimationFrame(raf)
      clearTimeout(restTimer)
      clearTimeout(resizeTimer)
      clearTimeout(labelTimer)
      clearInterval(hbTimer)
      ro.disconnect()
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerleave', onLeave)
    },
  }
}
