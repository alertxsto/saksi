import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { ConsoleReveal } from '@/components/controller/ConsoleReveal'
import { ControllerGallery } from './Gallery'

export const metadata: Metadata = { title: 'Controller states', robots: { index: false } }

export default function ControllerStatesPage() {
  return (
    <main id="main" className="mx-auto max-w-[1360px] px-4 py-10 md:px-8">
      <div className="mb-10 flex items-center justify-between">
        <Logo sub="Dev · controller states" />
        <span className="flex items-center gap-6">
          <Link href="/dev/states/controller/entry" className="label text-blue hover:underline">
            /enter states →
          </Link>
          <Link href="/dev" className="label text-blue hover:underline">
            ← Dev index
          </Link>
        </span>
      </div>
      <ControllerGallery />
      <ConsoleReveal />
    </main>
  )
}
