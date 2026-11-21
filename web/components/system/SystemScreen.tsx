import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { Cta } from '@/components/landing/Cta'
import { OdoText } from '@/components/landing/OdoText'
import { Heading } from '@/components/landing/Words'
import { RevealRoot } from '@/components/landing/RevealRoot'
import { LogoMark } from '@/components/ui/Logo'

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/**
 * One layout for every system screen (404s, reconnecting). Swap `art` and the copy; nothing else changes.
 * Measured from the landing (riset-ui/25 STYLE LOCK): hero grid (copy column ≤ 540, slab right from lg) inside
 * the nav's own box, so copy aligns with the logo and the slab with the nav's right edge; section heading 34/56 with word rise, body 16/17 at 1.6, Cta actions, hairline-separated mono meta.
 *
 * - `chrome="page"`: owns the document body: the landing nav shell (static), <main id="main">, full height.
 * - `chrome="embedded"`: a parent layout already renders the header and <main> (citizen column, /proof).
 *   `stack` forces the single-column order for narrow parents such as the 430 px citizen column.
 */
export function SystemScreen({
  chrome = 'page',
  stack = false,
  art,
  title,
  tail,
  body,
  meta,
  status,
  actions,
  wide = false,
}: {
  chrome?: 'page' | 'embedded'
  stack?: boolean
  art: ReactNode
  title: string
  tail?: string
  body: ReactNode
  /** Mono label row under the actions (the missing ID, the error reference), landing hero style. */
  meta?: ReactNode
  /** Live line between body and actions (the retry countdown). */
  status?: ReactNode
  actions: ReactNode
  /** Let a wide, short object (the chain) use more of the slab. */
  wide?: boolean
}) {
  const split = !stack
  const grid = (
    <div className={`grid w-full items-center gap-8 ${split ? 'lg:grid-cols-[minmax(0,556px)_minmax(0,1fr)] lg:gap-6' : ''}`}>
      <div
        className={`grain m-in relative flex items-center justify-center overflow-hidden rounded-[24px] bg-vault ${
          split ? 'aspect-[5/4] max-h-[46svh] w-full lg:order-2 lg:aspect-auto lg:h-[min(672px,calc(100svh-128px))] lg:max-h-none lg:min-h-[440px]' : 'aspect-[16/10]'
        }`}
        style={d(80)}
      >
        <div className={`relative z-[1] ${wide ? 'w-[88%] lg:w-[80%]' : split ? 'h-[86%] lg:h-auto lg:w-[64%]' : 'w-[62%]'} ${split && !wide ? 'aspect-square' : ''}`}>
          {art}
        </div>
      </div>
      {/* copy first on phones (headline + actions above the fold, like the landing hero); slab right from lg */}
      <div className={split ? `max-lg:order-first ${chrome === 'page' ? 'md:pl-4' : ''}` : 'order-first'}>
        <Heading
          as="h1"
          lead={title}
          tail={tail}
          className={`${split ? 'text-[34px] md:text-[56px]' : 'text-[34px]'} leading-[1.04]`}
        />
        <div className="m-in mt-6 max-w-[46ch] text-pretty text-[16px] leading-[1.6] tracking-[0.01em] text-ink-2 md:text-[17px]" style={d(280)}>
          {body}
        </div>
        {status ? (
          <div className="m-in mt-6" style={d(330)}>
            {status}
          </div>
        ) : null}
        <div className={`m-in mt-8 flex flex-wrap gap-3 ${stack ? 'flex-col' : ''}`} style={d(380)}>
          {actions}
        </div>
        {meta ? (
          <div className="m-in label mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-ink-2 max-sm:mt-8" style={d(480)}>
            {meta}
          </div>
        ) : null}
      </div>
      <RevealRoot />
    </div>
  )

  if (chrome === 'embedded') return <section className="flex flex-1 flex-col justify-center py-2 lg:py-6">{grid}</section>

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <SystemNav />
      {/* same box as the nav (px-3 md:px-12, max 1344): copy starts on the logo's x (nav pl-4), slab ends on the nav's right edge */}
      <main id="main" className="flex flex-1 items-center px-4 pb-10 pt-6 md:px-12 lg:pb-8 lg:pt-5">
        <div className="mx-auto w-full max-w-[1344px]">{grid}</div>
      </main>
    </div>
  )
}

const LINKS = [
  ['/#how', 'How it works'],
  ['/#breach', '72 hours'],
  ['/#roles', 'Roles'],
  ['/#verify', 'Verify'],
  ['/#faq', 'FAQ'],
] as const

/** The landing nav (components/landing/Nav) at rest: same box, logo, centred odometer links, live-demo Cta. Static. */
function SystemNav() {
  return (
    <header className="shrink-0 px-3 pt-3 md:px-12 md:pt-5">
      <div className="relative mx-auto flex h-14 max-w-[1344px] items-center rounded-lg pl-3 pr-1.5 md:pl-4">
        <Link href="/" className="flex min-h-11 items-center gap-2.5" aria-label="Saksi home">
          <LogoMark tone="paper" />
          <span className="text-[19px] font-semibold tracking-[-0.04em]">saksi</span>
        </Link>
        <nav aria-label="Sections" className="absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="nav-link flex min-h-11 items-center whitespace-nowrap rounded-sm px-3 text-[14px] font-medium tracking-[0.01em] transition-colors duration-150"
            >
              <OdoText>{label}</OdoText>
            </Link>
          ))}
        </nav>
        <Cta href="/enter" size="md" className="ml-auto max-[379px]:hidden">
          Open the app
        </Cta>
        <Cta href="/enter" size="md" className="ml-auto min-[380px]:hidden">
          Open the app
        </Cta>
      </div>
    </header>
  )
}

/** One item of the mono meta row: LABEL value. Rows separate items with the hero's 1 px hairline. */
export function SystemMeta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 truncate font-mono normal-case tracking-normal text-ink">{children}</span>
    </span>
  )
}

export const MetaRule = () => <span aria-hidden="true" className="h-4 w-px bg-line-strong max-sm:hidden" />
