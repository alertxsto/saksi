'use client'

// Dev test bench for the live Vault Seal: hero size, small sizes, verdict toggles, scroll room.

import { useState } from 'react'
import { VaultSealGL, type SealVerdict } from '@/components/ui/VaultSealGL'

const VERDICTS: SealVerdict[] = ['idle', 'match', 'altered']

export default function SealDevPage() {
  const [verdict, setVerdict] = useState<SealVerdict>('idle')
  const [receipt, setReceipt] = useState(true)

  return (
    <main className="min-h-screen bg-paper px-4 py-10 text-ink sm:px-10">
      <p className="label text-ink-3">/dev/seal · VaultSealGL</p>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Verdict">
        {VERDICTS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVerdict(v)}
            aria-pressed={verdict === v}
            data-verdict={v}
            className={`label rounded-pill border px-3 py-1.5 ${verdict === v ? 'border-ink bg-ink text-paper' : 'border-line-strong text-ink-2'}`}
          >
            {v}
          </button>
        ))}
        <label className="label ml-3 flex items-center gap-2 text-ink-2">
          <input type="checkbox" checked={receipt} onChange={(e) => setReceipt(e.target.checked)} />
          receipt edge
        </label>
      </div>

      <div className="h-[40vh]" />

      <section className="grid items-center gap-10 rounded-xl bg-vault p-6 sm:p-10 lg:grid-cols-[1fr_minmax(0,640px)]">
        <div>
          <h1 className="display text-[40px] text-vault-ink sm:text-[56px]">
            Who opened your data? <span className="text-vault-ink-2">Now there&apos;s a witness.</span>
          </h1>
          <p className="mt-4 max-w-md text-vault-ink-2">Move the cursor over the seal and scroll the page.</p>
        </div>
        <VaultSealGL verdict={verdict} receipt={receipt} title="Saksi vault seal" />
      </section>

      <div className="mt-10 flex flex-wrap items-end gap-6">
        {[160, 240, 360].map((w) => (
          <div key={w} style={{ width: w }}>
            <VaultSealGL verdict={verdict} receipt={receipt} overlay={false} grid={w >= 240} />
            <p className="label mt-2 text-ink-3">{w}px</p>
          </div>
        ))}
      </div>

      <div className="h-[120vh]" />
    </main>
  )
}
