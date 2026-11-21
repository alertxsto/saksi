import type { Metadata } from 'next'
import { ogCells, StillArt } from '@/components/system/SystemArt'
import { LogoMark } from '@/components/ui/Logo'

export const metadata: Metadata = { title: 'OG source', robots: { index: false } }

/**
 * Source for public/og/saksi-og.png (1200×630), screenshotted headless at #og. Everything that must survive
 * WhatsApp's square crop (logo, padlock, headline) sits inside the centre 630×630 (x 285–915). The receipt
 * (left) and the chain (right) only complete the story on the wide card: record → seal → chain.
 */
export default function OgSource() {
  return (
    <div id="og" className="relative h-[630px] w-[1200px] overflow-hidden bg-vault text-vault-ink">
      <StillArt cells={ogCells.receipt()} viewBox="6 2 28 36" className="absolute left-[-58px] top-[150px] h-[340px] w-auto opacity-50" />
      <StillArt cells={ogCells.chain()} viewBox="2 13 38 13" className="absolute right-[-118px] top-[268px] w-[380px] opacity-50" />
      <div className="absolute inset-y-0 left-[285px] flex w-[630px] flex-col items-center">
        <div className="mt-[72px] flex items-center gap-3">
          <LogoMark size={36} tone="vault" />
          <span className="text-[34px] font-semibold leading-none tracking-[-0.04em]">saksi</span>
        </div>
        <StillArt cells={ogCells.padlock()} label="Saksi padlock" viewBox="7.5 5 25 30" className="mt-[30px] h-[262px] w-auto" />
        <p className="mt-[30px] text-center text-[52px] font-medium leading-[1.06] tracking-[-0.02em]">
          Who opened your data?
          <br />
          <span className="text-vault-ink-2">Now there’s a witness.</span>
        </p>
      </div>
    </div>
  )
}
