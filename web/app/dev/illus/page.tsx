import type { Metadata } from 'next'
import { BreachIllus, ProofIllus, RecordIllus, SealIllus, VerifyIllus, WatchIllus } from '@/components/illus'

export const metadata: Metadata = { title: 'Illustrations', robots: { index: false } }

const ITEMS = [
  ['01 / RECORD', 'Company fills the access form, clicks Seal; entry lands in the ledger grid', RecordIllus],
  ['02 / SEAL', 'Fingerprint scanned, packets ride the connectors into the chain chip', SealIllus],
  ['03 / VERIFY', 'Phone checks the chain; needle springs to MATCH, bar meter fills', VerifyIllus],
  ['04 / WATCH', 'Database vs chain reconciled row by row; one row ALTERED', WatchIllus],
  ['05 / 72H', 'Breach clock: elapsed cells fill amber, red past the 72-hour line', BreachIllus],
  ['06 / PROOF', 'Magnifier over the ledger receipt; hash settles, verifiers confirm', ProofIllus],
] as const

export default function IllusGallery() {
  return (
    <main id="main" className="mx-auto max-w-[1360px] px-4 py-10 md:px-6">
      <p className="label text-ink-3">DEV / ILLUSTRATIONS</p>
      <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em]">
        Saksi line-art. <span className="text-ink-2">Six animated tiles.</span>
      </h1>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {ITEMS.map(([title, note, C]) => (
          <figure key={title} className="m-0">
            <C className="w-full" />
            <figcaption className="mt-2 flex gap-3 text-sm text-ink-2">
              <span className="label text-blue">{title}</span>
              <span>{note}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <h2 className="label mt-12 text-ink-3">UNFRAMED (PARENT OWNS THE TILE)</h2>
      <div className="mt-4 grid gap-6 rounded-[24px] border border-line bg-card p-6 md:grid-cols-3">
        <RecordIllus framed={false} />
        <SealIllus framed={false} />
        <VerifyIllus framed={false} />
      </div>
    </main>
  )
}
