// Imperative WebGL2 renderer for the Vault Seal (framework-agnostic; the React wrapper lives in
// components/ui/VaultSealGL.tsx). Pass 1 renders the procedural padlock into an n×n RGBA8 cell
// texture, pass 2 draws the dot matrix at full resolution. Only runs a rAF loop while active.

import { DEG, approach, easeOut, hexRgb, mix3, rotRows } from './math'
import { DOTS_FS, SCENE_FS, VS } from './shaders'

export type Verdict = 'idle' | 'match' | 'altered'

export type SealRenderer = {
  resize(cssWidth: number, dpr: number): void
  setActive(on: boolean): void
  setVerdict(v: Verdict): void
  /** Lights the dots of one step: 0 receipt edge, 1 shackle, 2 check keyhole; -1 none. */
  setFocus(step: number): void
  /** Section progress through the viewport, 0..1 (0.5 = centred). */
  setScroll(p: number): void
  /** Pointer in board uv (0..1, y down), or null when it leaves. */
  pointer(x: number | null, y?: number): void
  destroy(): void
}

const ICE: Record<Verdict, string> = { idle: '#9BD9E0', match: '#5BCB8A', altered: '#FF5A4D' }
const TRAIL = 24
const TRAIL_LIFE = 1.5
const WAVE_MS = 600

type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }

function build(gl: WebGL2RenderingContext, fs: string, names: string[]): Prog | null {
  const p = gl.createProgram()
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VS],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[seal] shader:', gl.getShaderInfoLog(s))
      return null
    }
    gl.attachShader(p, s)
    gl.deleteShader(s)
  }
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null
  const u: Prog['u'] = {}
  for (const n of names) u[n] = gl.getUniformLocation(p, n)
  return { p, u }
}

export function createSealRenderer(
  canvas: HTMLCanvasElement,
  opts: { receipt?: boolean; pitch?: number; verdict?: Verdict; onLost?: () => void } = {},
): SealRenderer | null {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false })
  if (!gl) return null
  const scene = build(gl, SCENE_FS, ['uCell', 'uRot', 'uLift', 'uTime', 'uFocus', 'uTrail', 'uReceipt'])
  const dots = build(gl, DOTS_FS, ['uCells', 'uCols', 'uGeom', 'uBg', 'uDot', 'uDot2', 'uIceA', 'uIceB', 'uWave', 'uTime'])
  if (!scene || !dots) return null

  const tex = gl.createTexture()
  const fbo = gl.createFramebuffer()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  gl.useProgram(dots.p)
  gl.uniform1i(dots.u.uCells, 0)
  gl.uniform3fv(dots.u.uBg, hexRgb('#24211D'))
  gl.uniform3fv(dots.u.uDot, hexRgb('#6E6457'))
  gl.uniform3fv(dots.u.uDot2, hexRgb('#8A7F70'))
  gl.useProgram(scene.p)
  gl.uniform1f(scene.u.uReceipt, opts.receipt === false ? 0 : 1)

  let n = 0 // cells per side
  let cs = 1 // cell size, device px
  let off = 0 // grid offset, device px
  let size = 0 // canvas side, device px
  let active = false
  let raf = 0
  let last = 0
  const t0 = performance.now()

  let verdict: Verdict = opts.verdict ?? 'idle'
  let iceA = hexRgb(ICE[verdict])
  let iceB = iceA
  let waveAt = -1e9
  let boost = verdict === 'idle' ? 0 : 1

  let yaw = 0
  let tiltX = 0
  let tiltY = 0
  let aimX = 0
  let aimY = 0
  let scroll = 0.5
  let step = -1
  const focus = [0, 0, 0]
  const trail: Array<{ x: number; y: number; t: number }> = [] // x = NaN marks a break
  const trailBuf = new Float32Array(TRAIL * 3)

  const frame = (now: number) => {
    const t = (now - t0) / 1000
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016)
    last = now

    tiltX += (aimX - tiltX) * approach(dt, 3)
    tiltY += (aimY - tiltY) * approach(dt, 3)
    const yawT = 12 * DEG * Math.sin(t * 0.42) + (scroll - 0.5) * 70 * DEG + tiltX * 12 * DEG
    yaw += (yawT - yaw) * approach(dt, 4)
    const pitch = 0.17 + 3 * DEG * Math.sin(t * 0.6) - tiltY * 7 * DEG

    for (let i = 0; i < 3; i++) focus[i] += ((i === step ? 1 : 0) - focus[i]) * approach(dt, 5)
    boost += ((verdict === 'idle' ? 0 : 1) - boost) * approach(dt, 4)

    // trail: newest first, strength fades with age
    while (trail.length && t - trail[0].t > TRAIL_LIFE) trail.shift()
    trailBuf.fill(0)
    for (let i = 0; i < TRAIL && i < trail.length; i++) {
      const p = trail[trail.length - 1 - i]
      if (Number.isNaN(p.x)) continue
      trailBuf[i * 3] = p.x
      trailBuf[i * 3 + 1] = p.y
      trailBuf[i * 3 + 2] = Math.max(0, 1 - (t - p.t) / TRAIL_LIFE)
    }

    const w = (now - waveAt) / WAVE_MS
    const waveR = w >= 1 ? 1.2 : easeOut(w) * 0.95

    // pass 1: padlock -> cell texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.viewport(0, 0, n, n)
    gl.useProgram(scene.p)
    gl.uniform2f(scene.u.uCell, cs / size, off / size)
    gl.uniformMatrix3fv(scene.u.uRot, false, rotRows(yaw, pitch))
    gl.uniform1f(scene.u.uLift, 0.025 * Math.sin(t * 0.8))
    gl.uniform1f(scene.u.uTime, t)
    gl.uniform3fv(scene.u.uFocus, focus)
    gl.uniform3fv(scene.u.uTrail, trailBuf)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // pass 2: dots
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, size, size)
    gl.useProgram(dots.p)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1f(dots.u.uCols, n)
    gl.uniform3f(dots.u.uGeom, cs, off, size)
    gl.uniform3fv(dots.u.uIceA, iceA)
    gl.uniform3fv(dots.u.uIceB, iceB)
    gl.uniform3f(dots.u.uWave, waveR, boost, w < 1 ? 1 : 0)
    gl.uniform1f(dots.u.uTime, t)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  const loop = (now: number) => {
    frame(now)
    raf = active ? requestAnimationFrame(loop) : 0
  }

  const draw = () => {
    if (n && !active) frame(performance.now())
  }

  const lost = (e: Event) => {
    e.preventDefault()
    active = false
    cancelAnimationFrame(raf)
    opts.onLost?.()
  }
  canvas.addEventListener('webglcontextlost', lost)

  return {
    resize(cssWidth, dpr) {
      const s = Math.max(1, Math.round(cssWidth * dpr))
      const pitchCss = opts.pitch ?? Math.min(8.5, Math.max(3.5, cssWidth / 88))
      cs = Math.max(3, Math.round(pitchCss * dpr))
      const nn = Math.max(8, Math.floor(s / cs))
      off = (s - nn * cs) / 2
      if (s !== size) canvas.width = canvas.height = size = s
      if (nn !== n) {
        n = nn
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      }
      draw()
    },
    setActive(on) {
      if (on === active) return
      active = on
      last = 0
      if (on) raf = requestAnimationFrame(loop)
      else cancelAnimationFrame(raf)
    },
    setVerdict(v) {
      if (v === verdict) return
      const w = (performance.now() - waveAt) / WAVE_MS
      iceA = w >= 1 ? iceB : mix3(iceA, iceB, easeOut(w))
      iceB = hexRgb(ICE[v])
      verdict = v
      waveAt = performance.now()
      draw()
    },
    setFocus(s) {
      step = s
    },
    setScroll(p) {
      scroll = Math.min(1, Math.max(0, p))
    },
    pointer(x, y = 0) {
      const t = (performance.now() - t0) / 1000
      const prev = trail[trail.length - 1]
      if (x === null) {
        aimX = aimY = 0
        if (prev && !Number.isNaN(prev.x)) trail.push({ x: NaN, y: NaN, t })
        return
      }
      aimX = x - 0.5
      aimY = y - 0.5
      if (prev && Math.hypot(prev.x - x, prev.y - (1 - y)) < 0.006) return
      trail.push({ x, y: 1 - y, t })
      if (trail.length > TRAIL) trail.shift()
    },
    destroy() {
      active = false
      cancelAnimationFrame(raf)
      canvas.removeEventListener('webglcontextlost', lost)
      gl.deleteTexture(tex)
      gl.deleteFramebuffer(fbo)
      gl.deleteProgram(scene.p)
      gl.deleteProgram(dots.p)
    },
  }
}
