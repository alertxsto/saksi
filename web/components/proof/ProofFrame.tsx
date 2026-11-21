import type { ReactNode } from 'react'
import { AppHeader } from '@/components/ui/AppHeader'

/**
 * Public verifier shell: the shared AppHeader (role "Public verifier", no login) over a centred,
 * document-width column (max 960). No citizen tab bar: this page belongs to whoever holds the link,
 * and the phone keeps the bottom edge for the page's one sticky action.
 */
export function ProofFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader actor="verifier" role="Public verifier" area="proof" nav={[]} right={<span className="text-[13px] text-ink-3">No login · runs in your browser</span>} />
      <main id="main" className="px-4 pb-6 pt-6 sm:px-6 md:pb-20 md:pt-10">
        <div className="mx-auto w-full max-w-[960px]">{children}</div>
      </main>
    </>
  )
}
