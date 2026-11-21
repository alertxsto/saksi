import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { EntryGallery } from './EntryGallery'

export const metadata: Metadata = { title: 'Sign-in states', robots: { index: false } }

export default function EntryStatesPage() {
  return (
    <main id="main" className="ws py-10">
      <div className="mb-10 flex items-center justify-between">
        <Logo sub="Dev · /enter states" />
        <Link href="/dev/states/controller" className="label text-blue hover:underline">
          ← Controller states
        </Link>
      </div>
      <EntryGallery />
    </main>
  )
}
