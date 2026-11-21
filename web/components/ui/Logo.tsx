import Link from 'next/link'

// "A · Dot-matrix S" mark (public/brand/saksi-mark-24.svg): ink dots, two accent terminals.
const BODY =
  "M6.9 1.86A1.72 1.72 0 1 0 10.34 1.86A1.72 1.72 0 1 0 6.9 1.86ZM10.28 1.86A1.72 1.72 0 1 0 13.72 1.86A1.72 1.72 0 1 0 10.28 1.86ZM13.66 1.86A1.72 1.72 0 1 0 17.1 1.86A1.72 1.72 0 1 0 13.66 1.86ZM3.52 5.24A1.72 1.72 0 1 0 6.96 5.24A1.72 1.72 0 1 0 3.52 5.24ZM3.52 8.62A1.72 1.72 0 1 0 6.96 8.62A1.72 1.72 0 1 0 3.52 8.62ZM6.9 12A1.72 1.72 0 1 0 10.34 12A1.72 1.72 0 1 0 6.9 12ZM10.28 12A1.72 1.72 0 1 0 13.72 12A1.72 1.72 0 1 0 10.28 12ZM13.66 12A1.72 1.72 0 1 0 17.1 12A1.72 1.72 0 1 0 13.66 12ZM17.04 15.38A1.72 1.72 0 1 0 20.48 15.38A1.72 1.72 0 1 0 17.04 15.38ZM17.04 18.76A1.72 1.72 0 1 0 20.48 18.76A1.72 1.72 0 1 0 17.04 18.76ZM6.9 22.14A1.72 1.72 0 1 0 10.34 22.14A1.72 1.72 0 1 0 6.9 22.14ZM10.28 22.14A1.72 1.72 0 1 0 13.72 22.14A1.72 1.72 0 1 0 10.28 22.14ZM13.66 22.14A1.72 1.72 0 1 0 17.1 22.14A1.72 1.72 0 1 0 13.66 22.14Z"
const TERMINALS = "M17.04 1.86A1.72 1.72 0 1 0 20.48 1.86A1.72 1.72 0 1 0 17.04 1.86ZM3.52 22.14A1.72 1.72 0 1 0 6.96 22.14A1.72 1.72 0 1 0 3.52 22.14Z"

export function LogoMark({ size = 24, tone = "paper" }: { size?: number; tone?: "paper" | "vault" }) {
  const vault = tone === "vault"
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path d={BODY} fill={vault ? "#EDE9E1" : "#1E1A16"} />
      <path d={TERMINALS} fill={vault ? "#9BD9E0" : "#2A2AE8"} />
    </svg>
  )
}

export function Logo({ href = "/", sub, tone = "paper" }: { href?: string; sub?: string; tone?: "paper" | "vault" }) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-2.5" aria-label="Saksi home">
      <LogoMark tone={tone} />
      <span className={`text-[19px] font-semibold tracking-[-0.04em] ${tone === "vault" ? "text-vault-ink" : "text-ink"}`}>saksi</span>
      {sub ? <span className="label hidden border-l border-line pl-2.5 text-ink-2 sm:inline">{sub}</span> : null}
    </Link>
  )
}
