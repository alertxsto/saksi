// Hash scramble (riset-ui/09 §4.6): each char cycles random glyphs at 24 Hz and resolves
// left to right, 30 ms apart. Writes textContent directly — no React state per frame.

const HEX = '0123456789abcdef'

export function scramble(
  el: HTMLElement,
  final: string,
  { alphabet = HEX, stepMs = 30, hz = 24, keep = /[^0-9a-f]/i }: { alphabet?: string; stepMs?: number; hz?: number; keep?: RegExp } = {},
): () => void {
  let raf = 0
  let last = 0
  const t0 = performance.now()
  const frame = (now: number) => {
    const t = now - t0
    if (now - last >= 1000 / hz || t >= final.length * stepMs) {
      last = now
      let s = ''
      for (let i = 0; i < final.length; i++) {
        const c = final[i]
        s += t >= i * stepMs + 120 || keep.test(c) ? c : alphabet[(Math.random() * alphabet.length) | 0]
      }
      el.textContent = s
      if (s === final) return
    }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return () => {
    cancelAnimationFrame(raf)
    el.textContent = final
  }
}
