import Link from 'next/link'
import type { ReactNode } from 'react'
import { DotIcon } from '@/components/ui/DotIcon'
import { IconX } from '@/components/ui/icons'

/**
 * Receipts master–detail. Phone (< 1024 px of shell width): one column, `focus` decides which side shows,
 * so /citizen is the list and /citizen/receipt/[id] is the full-page detail, exactly as before.
 * Laptop (≥ 1024 px, container query on the citizen shell): list column + sticky detail pane.
 * Container queries (not media queries) so the dev gallery can render phone and laptop frames side by side.
 */
export function ReceiptsSplit({
  list,
  pane,
  focus,
  closeHref = '/citizen',
}: {
  list: ReactNode
  pane: ReactNode
  /** Which side a phone shows. 'pane' = a receipt is open. */
  focus: 'list' | 'pane'
  /** Pane close (laptop only), shown while a receipt is open. */
  closeHref?: string
}) {
  const open = focus === 'pane'
  return (
    <div className="flex flex-1 flex-col @5xl:grid @5xl:grid-cols-[380px_minmax(0,1fr)] @7xl:grid-cols-[420px_minmax(0,1fr)] @5xl:items-start">
      <div
        className={`${open ? 'hidden @5xl:flex' : 'flex'} min-w-0 flex-col @5xl:min-h-dvh @5xl:px-6 @5xl:pb-16 @5xl:pt-7`}
      >
        {list}
      </div>
      <section
        aria-label={open ? 'Receipt' : undefined}
        className={`${open ? 'flex' : 'hidden @5xl:flex'} ws-pane min-w-0 flex-col @5xl:sticky @5xl:top-0 @5xl:h-dvh @5xl:overflow-y-auto @5xl:border-l @5xl:border-line @5xl:bg-card/50`}
      >
        {open ? (
          <div className="sticky top-0 z-10 hidden items-center justify-between border-b border-line bg-card/90 px-6 py-2 backdrop-blur-md @5xl:flex">
            <span className="text-[13px] font-medium text-ink-2">Receipt</span>
            <Link
              href={closeHref}
              aria-label="Close receipt"
              className="-mr-2 flex h-9 w-9 items-center justify-center rounded-sm text-ink-2 transition-colors duration-150 hover:bg-paper-2 hover:text-ink"
            >
              <IconX size={16} />
            </Link>
          </div>
        ) : null}
        <div className={`flex flex-1 flex-col ${open ? '@5xl:mx-auto @5xl:w-full @5xl:max-w-[600px] @5xl:px-8 @5xl:pb-16 @5xl:pt-7' : ''}`}>
          {pane}
        </div>
      </section>
    </div>
  )
}

/** Laptop pane before a receipt is picked. Phones never see it (the list is the page). */
export function SelectReceiptPane({ count }: { count?: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-10 py-24 text-center">
      <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-lg bg-paper-2 text-ink-3">
        <DotIcon name="eye" size={30} />
      </span>
      <p className="mt-5 text-[19px] font-medium leading-snug tracking-[-0.015em] text-ink">Select a receipt</p>
      <p className="mt-1.5 max-w-[34ch] text-[15px] leading-[1.6] tracking-[0.01em] text-ink-2">
        {count === 0
          ? 'Receipts land here the moment a company opens your data.'
          : 'Open one to see who opened your data, why, and whether it still matches the chain.'}
      </p>
    </div>
  )
}
