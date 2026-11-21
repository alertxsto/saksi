import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'

/**
 * /dev holds mock galleries and demo toggles. Hidden in production builds unless
 * NEXT_PUBLIC_SHOW_DEV=1 is set (e.g. on a staging deploy for teammates).
 */
const SHOW_DEV = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_DEV === '1'

export default function DevLayout({ children }: { children: ReactNode }) {
  if (!SHOW_DEV) notFound()
  return children
}
