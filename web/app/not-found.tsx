import type { Metadata } from 'next'
import { NotFoundScreen } from '@/components/system/NotFoundScreen'

export const metadata: Metadata = { title: 'Nothing sealed here' }

/** Wrong URL anywhere in the app (and any notFound() without a closer not-found file). */
export default function NotFound() {
  return <NotFoundScreen kind="page" />
}
