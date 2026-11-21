import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EnterHeader } from '@/components/entry/EnterHeader'
import { EnterView } from '@/components/entry/EnterView'
import { toDoor } from '@/components/entry/RoleChip'

export const metadata: Metadata = {
  title: 'Choose your role',
  description: 'Enter Saksi as a citizen, an agency or the regulator. Each door says what you will see and who you will be.',
}

type Search = Promise<Record<string, string | string[] | undefined>>

export default function EnterPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <EnterHeader />
      <main id="main" className="pb-16 pt-6 md:pb-20 md:pt-10">
        <div className="ws max-w-[1240px]!">
          {/* search params are request data: read them inside Suspense (cacheComponents) */}
          <Suspense fallback={<EnterView />}>
            <Gate searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </>
  )
}

async function Gate({ searchParams }: { searchParams: Search }) {
  return <EnterView as={toDoor((await searchParams).as)} />
}
