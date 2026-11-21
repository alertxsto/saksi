// ASCII dither from a 4×4 Bayer matrix, generated once on the server. Decorative only.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

function band(cols: number, rows: number) {
  let out = ''
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // horizontal gradient with a soft wave: dense on the left, sparse on the right
      const v = 1 - x / cols + 0.12 * Math.sin((x + y * 3) / 9)
      const t = (BAYER[y % 4][x % 4] + 0.5) / 16
      out += v > t + 0.18 ? 'x' : v > t - 0.1 ? '/' : v > t - 0.3 ? '·' : ' '
    }
    out += '\n'
  }
  return out
}

export function DitherBand({ cols = 220, rows = 14, className = '' }: { cols?: number; rows?: number; className?: string }) {
  return (
    <pre aria-hidden="true" className={`pointer-events-none select-none overflow-hidden font-mono text-[9px] leading-none ${className}`}>
      {band(cols, rows)}
    </pre>
  )
}
