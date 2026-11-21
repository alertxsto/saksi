import type { Metadata } from 'next'
import { LogoMark } from '@/components/ui/Logo'

export const metadata: Metadata = { title: 'Icon source', robots: { index: false } }

/** Source for public/apple-touch-icon.png (180×180, full bleed: iOS rounds the corners itself). */
export default function IconSource() {
  return (
    <div id="icon" className="flex size-[180px] items-center justify-center bg-blue">
      <LogoMark size={116} tone="vault" />
    </div>
  )
}
