import { Logo } from '@/components/ui/Logo'
import { TabBar } from '@/components/ui/TabBar'

export default function ProofLayout({ children }: LayoutProps<'/proof'>) {
  return (
    <>
      <header className="no-print sticky top-0 z-40 px-4 pt-3 md:px-6">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-line bg-card/90 px-3 backdrop-blur-md md:px-4">
            <Logo sub="Public verifier" />
            <span className="label hidden text-ink-2 sm:inline">Runs in your browser · no login</span>
          </div>
        </div>
      </header>
      <main id="main" className="px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-8 md:px-6 md:pb-20 md:pt-12">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
      <div className="md:hidden">
        <TabBar />
      </div>
    </>
  )
}
