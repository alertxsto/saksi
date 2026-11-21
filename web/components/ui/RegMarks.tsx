/** Registration marks: 6×6 squares on the four corners of an important panel. Parent must be `relative`. */
export function RegMarks({ className = 'bg-ink', size = 6 }: { className?: string; size?: number }) {
  const o = -size / 2
  const s = { width: size, height: size }
  return (
    <>
      <span aria-hidden="true" className={`pointer-events-none absolute ${className}`} style={{ ...s, top: o, left: o }} />
      <span aria-hidden="true" className={`pointer-events-none absolute ${className}`} style={{ ...s, top: o, right: o }} />
      <span aria-hidden="true" className={`pointer-events-none absolute ${className}`} style={{ ...s, bottom: o, left: o }} />
      <span aria-hidden="true" className={`pointer-events-none absolute ${className}`} style={{ ...s, bottom: o, right: o }} />
    </>
  )
}
