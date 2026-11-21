import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './identity.css'

export const metadata: Metadata = { title: 'Identity directions', robots: { index: false } }

export default function IdentityLayout({ children }: { children: ReactNode }) {
  return children
}
