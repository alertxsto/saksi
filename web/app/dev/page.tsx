import type { Metadata } from 'next'
import Link from 'next/link'
import { Eyebrow, TwoTone } from '@/components/ui/Chip'
import { IconArrow } from '@/components/ui/icons'
import { Logo } from '@/components/ui/Logo'
import { encodeOpening, proofPath } from '@/lib/format'
import { mockAllReceipts } from '@/lib/mock'

export const metadata: Metadata = { title: 'Dev index', robots: { index: false } }

// Fixed clock so this page can be prerendered.
const SAMPLE = mockAllReceipts(Date.UTC(2026, 10, 21, 7, 3), 'K7M2QD')[1]
const PROOF = proofPath(SAMPLE)
const BROKEN = `/proof/${SAMPLE.txHash}/${SAMPLE.logIndex}#${encodeOpening(SAMPLE).slice(0, 40)}`

const GROUPS: { title: string; links: [string, string, string?][] }[] = [
  {
    title: 'Landing',
    links: [['/', 'Landing page (nav, hero seal cycler, proof, roles, limits, CTA + QR)']],
  },
  {
    title: 'Citizen · mobile 390',
    links: [
      ['/dev/states/citizen', 'ALL citizen states side by side at 390 px (gallery, mock data)'],
      ['/citizen', 'Live: onboarding (no session cookie) → receipts list'],
      ['/citizen/profile', 'Live: profile + QR + delete demo'],
    ],
  },
  {
    title: 'Controller · desktop 1440',
    links: [
      ['/dev/states/controller', 'Controller state gallery (wallet ×6, form, stepper + errors, recent, breach paths, mock data)'],
      ['/controller', 'Live: record access · WalletGate · form · TxStepper · recent 10'],
      ['/controller/breach', 'Live: breach notice · AI draft · 72 H countdown · contract check'],
    ],
  },
  {
    title: 'Regulator · desktop 1440',
    links: [
      ['/dev/states/regulator', 'ALL regulator + /proof states on one page (gallery, mock data)'],
      ['/regulator', 'Live: breach notices · KPIs · list + detail'],
      ['/regulator/watch', 'Live: Watch (Sepolia journal vs database)'],
    ],
  },
  {
    title: 'Proof · public verifier',
    links: [
      ['/proof', 'Live: paste a proof link · Scan QR · Upload receipt JSON'],
      [PROOF, 'Mock proof link (opening in #hash); verifies against the configured chain, so expect NOT FOUND'],
      [BROKEN, 'Broken link state (truncated #hash)'],
    ],
  },
]

export default function DevPage() {
  return (
    <main id="main" className="mx-auto max-w-[960px] px-4 py-10 md:px-6">
      <Logo sub="Dev index" />
      <Eyebrow className="mt-10">/DEV · HIDDEN · MOCK DATA</Eyebrow>
      <TwoTone head="Every screen." tail="Every state." className="mt-3 text-[40px]" />
      <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">
        The galleries under <code className="font-mono text-ink">/dev/states</code> render every state from mock data.
        The app routes themselves always use the real API and the Sepolia contracts.
      </p>
      <div className="mt-10 flex flex-col gap-10">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="label text-ink">{g.title}</h2>
            <ul className="mt-3 border border-line bg-card">
              {g.links.map(([href, label]) => (
                <li key={href} className="border-b border-line last:border-b-0">
                  <Link href={href} className="group flex min-h-12 items-center gap-4 px-4 py-2.5 hover:bg-paper" prefetch={false}>
                    <code className="w-[300px] shrink-0 truncate font-mono text-[12px] text-blue">{href}</code>
                    <span className="flex-1 text-[14px] text-ink">{label}</span>
                    <IconArrow size={14} className="text-ink-2 group-hover:text-blue" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
