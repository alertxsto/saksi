import Link from 'next/link'
import { LogoMark } from '@/components/ui/Logo'
import { IconArrow } from '@/components/ui/icons'
import { OdoText } from '@/components/landing/OdoText'

/** /enter top bar: logo → home on the left, "Back to home" on the right; same box and edges as the app header. */
export function EnterHeader() {
  return (
    <header className="pt-2 md:pt-3">
      <div className="ws ws-bar">
        <div className="flex h-14 items-center justify-between gap-3 pl-2 pr-1.5 md:pl-4">
          <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-sm" aria-label="Saksi home">
            <LogoMark />
            <span className="text-[19px] font-semibold tracking-[-0.04em] text-ink">saksi</span>
          </Link>
          <Link
            href="/"
            className="nav-link group flex min-h-11 items-center gap-2 rounded-sm px-3 text-[14px] font-medium tracking-[0.01em] transition-colors duration-150"
          >
            <IconArrow size={15} className="rotate-180 transition-transform duration-150 group-hover:-translate-x-0.5" />
            <OdoText>Back to home</OdoText>
          </Link>
        </div>
      </div>
    </header>
  )
}
