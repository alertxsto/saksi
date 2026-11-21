// Dev test bench for the pinned Witness film: spacer above and below so the pin can be scrolled.

import { LatticeObject, StoryPin } from '@/components/landing/StoryPin'

export default function StoryDevPage() {
  return (
    <main id="main" className="min-h-screen bg-paper text-ink">
      <div className="flex h-[100vh] items-end px-6 pb-16 sm:px-10">
        <p className="label text-ink-3">/dev/story · StoryPin · scroll</p>
      </div>
      <StoryPin />
      <div className="mx-auto grid max-w-[1100px] grid-cols-2 gap-6 px-6 py-24 sm:grid-cols-4 sm:px-10">
        {(['padlock', 'receipt', 'fingerprint', 'block', 'check', 'alert', 'clock'] as const).map((s) => (
          <div key={s} className="rounded-xl bg-vault p-4">
            <LatticeObject shape={s} param={s === 'clock' ? 0.3 : undefined} title={s} />
            <p className="label mt-2 text-vault-ink-2">{s}</p>
          </div>
        ))}
        <div className="rounded-xl border border-line p-4">
          <LatticeObject shape="clock" param={0.3} surface="paper" title="clock on paper" />
          <p className="label mt-2 text-ink-3">clock · paper</p>
        </div>
      </div>
      <div className="h-[60vh]" />
    </main>
  )
}
