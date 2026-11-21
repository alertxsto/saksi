import type { Metadata } from 'next'
import { EnterHeader } from '@/components/entry/EnterHeader'
import { EnterView } from '@/components/entry/EnterView'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Choose your side: citizen, data controller or regulator.',
}

export default function EnterPage() {
  return (
    <>
      <EnterHeader />
      <main id="main" className="pb-16 pt-8 md:pb-20 md:pt-10">
        <div className="ws">
          <EnterView />
        </div>
      </main>
    </>
  )
}
