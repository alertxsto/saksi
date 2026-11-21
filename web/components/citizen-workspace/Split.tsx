import Link from 'next/link'
import type { ReactNode } from 'react'
import { DotIcon } from '@/components/ui/DotIcon'
import { IconX } from '@/components/ui/icons'
import '@/app/citizen/stub-list.css'
import '@/app/citizen/witness.css'

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
  paneKey,
}: {
  list: ReactNode
  pane: ReactNode
  /** Which side a phone shows. 'pane' = a receipt is open. */
  focus: 'list' | 'pane'
  /** Pane close (laptop only), shown while a receipt is open. */
  closeHref?: string
  /** The open receipt: a change re-keys the pane so it cross-fades (220 ms) instead of snapping. */
  paneKey?: string
}) {
  const open = focus === 'pane'
  return (
    <div className="flex flex-1 flex-col @5xl:grid @5xl:grid-cols-[380px_minmax(0,1fr)] @7xl:grid-cols-[440px_minmax(0,1fr)] @5xl:items-start">
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
        <div
          key={paneKey ?? 'none'}
          className={`flex flex-1 flex-col ${paneKey ? 'wt-pane' : ''} ${open ? '@5xl:mx-auto @5xl:w-full @5xl:max-w-[600px] @5xl:px-8 @5xl:pb-16 @5xl:pt-7' : ''}`}
        >
          {pane}
        </div>
      </section>
    </div>
  )
}

/**
 * Laptop pane before a receipt is picked (Mail / Linear empty detail): a ghost stub, one line, and the
 * keyboard hint. With no receipts at all it says what will land here instead. Phones never see it.
 */
export function SelectReceiptPane({ count }: { count?: number }) {
  const none = count === 0
  return (
    <div className="wt-fade flex flex-1 flex-col items-center justify-center px-10 py-24 text-center">
      <div aria-hidden="true" className="relative flex h-[64px] w-[220px] items-stretch rounded-[14px] border-[1.5px] border-dashed border-line-strong">
        <span className="flex w-[58px] shrink-0 items-center justify-center text-ink-3">
          <DotIcon name="eye" size={20} />
        </span>
        <span className="sl-perf-v absolute bottom-2.5 left-[57px] top-2.5 text-line-strong" />
        <span className="flex flex-1 flex-col justify-center gap-1.5 pl-4 pr-4">
          <span className="h-2 w-[70%] rounded-full bg-line" />
          <span className="h-2 w-[45%] rounded-full bg-line/70" />
        </span>
      </div>
      <p className="mt-6 text-[19px] font-medium leading-snug tracking-[-0.015em] text-ink">{none ? 'No receipts yet' : 'Pick a receipt'}</p>
      <p className="mt-1.5 max-w-[36ch] text-[15px] leading-[1.6] text-ink-2">
        {none
          ? 'When an agency opens your record, Saksi witnesses it and the receipt lands here.'
          : 'Each receipt is an access Saksi witnessed: who opened your data, why, and whether it still matches the seal.'}
      </p>
      {none ? null : (
        <p className="mt-5 flex items-center gap-2 text-[13px] text-ink-3">
          <kbd className="wt-kbd">↑</kbd>
          <kbd className="wt-kbd">↓</kbd>
          to move between receipts
        </p>
      )}
    </div>
  )
}
