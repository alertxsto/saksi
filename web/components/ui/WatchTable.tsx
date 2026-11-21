'use client'

import { fieldLabel, humanValue } from '@/components/regulator/labels'
import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import type { WatchRowView } from '@/lib/data'
import { shortHex } from '@/lib/format'
import { Badge, type StatusKind } from './Badge'
import { IconCheck, IconMinus, IconX } from './icons'

const KIND: Record<WatchRowView['status'], StatusKind> = {
  MATCH: 'MATCH',
  ALTERED: 'ALTERED',
  DELETED: 'DELETED',
  NOT_ANCHORED: 'NOT_ANCHORED',
}

const ORDER: Record<WatchRowView['status'], number> = { ALTERED: 0, DELETED: 1, NOT_ANCHORED: 2, MATCH: 3 }

/** Problem rows first (ALTERED on top), then by receipt number. */
export function sortWatch(rows: WatchRowView[]) {
  return [...rows].sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.ref.localeCompare(a.ref))
}

const fieldName = (r: WatchRowView) => (r.field && r.field !== 'row' && r.field !== 'txHash' ? fieldLabel(r.field) : null)

/**
 * Live watch table. Rows re-sort every poll; a row that moves glides to its new place (FLIP, 700 ms),
 * so a receipt that flips to ALTERED visibly rises to the top while it flashes red (`flashRef`).
 * New rows slide in. Reduced motion: rows jump, no flash animation (globals.css).
 */
export function WatchTable({
  rows,
  selected,
  onSelect,
  flashRef,
}: {
  rows: WatchRowView[]
  selected?: string | null
  onSelect?: (ref: string) => void
  flashRef?: string | null
}) {
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const tops = useRef(new Map<string, number>())
  const order = useRef<string | null>(null)

  // FLIP, only when the row order changes: measure each row's new offsetTop, start it at its old one
  // (translateY), then let it glide to 0. Re-renders mid-glide (the 1 s clock, polling) leave it alone.
  useLayoutEffect(() => {
    const body = bodyRef.current
    const key = rows.map((r) => r.ref).join('|')
    if (!body || key === order.current) return
    const first = order.current === null
    order.current = key
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = new Map<string, number>()
    const moved: HTMLElement[] = []
    body.querySelectorAll<HTMLElement>('tr[data-ref]').forEach((tr) => {
      const ref = tr.dataset.ref!
      const top = tr.offsetTop
      next.set(ref, top)
      const prev = tops.current.get(ref)
      if (reduced || first) return
      if (prev === undefined) {
        tr.classList.remove('rg-row-new')
        void tr.offsetWidth
        tr.classList.add('rg-row-new')
      } else if (prev !== top) {
        tr.style.transition = 'none'
        tr.style.transform = `translateY(${prev - top}px)`
        tr.style.position = 'relative'
        tr.style.zIndex = prev > top ? '2' : '1'
        moved.push(tr)
      }
    })
    tops.current = next
    if (!moved.length) return
    void body.offsetHeight
    // Not cancelled on re-render: a cancelled frame would leave rows stuck at their old place.
    requestAnimationFrame(() =>
      moved.forEach((tr) => {
        tr.style.transition = 'transform 760ms var(--ease-out-expo)'
        tr.style.transform = ''
        tr.addEventListener('transitionend', () => tr.style.removeProperty('z-index'), { once: true })
      }),
    )
  })

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-card">
      <table className="w-full min-w-[700px] border-collapse text-left">
        <caption className="sr-only">Receipts compared: database versus chain</caption>
        <thead>
          <tr className="border-b border-line">
            {['Receipt', 'Controller', 'Database says', 'Chain sealed', 'Status'].map((h) => (
              <th key={h} scope="col" className="label px-4 py-3.5 text-[11px] font-normal text-ink-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={bodyRef}>
          {rows.map((r, i) => {
            const problem = r.status !== 'MATCH'
            const altered = r.status === 'ALTERED'
            // ALTERED and DELETED are proof of a change (red); NOT ANCHORED is pending (amber).
            const bad = altered || r.status === 'DELETED'
            const isSel = selected === r.ref
            const flash = flashRef === r.ref
            const f = fieldName(r)
            return (
              <tr
                key={r.ref}
                data-ref={r.ref}
                data-sel={isSel || undefined}
                style={{ '--i': i } as CSSProperties}
                className={`rg-row border-b border-line bg-card last:border-b-0 ${altered ? 'rg-row-bad' : ''} ${flash ? 'rg-row-flash' : ''}`}
              >
                <td className="relative px-4 py-3 align-top">
                  <span aria-hidden="true" className={`rg-row-bar absolute inset-y-0 left-0 w-[3px] ${bad ? 'bg-bad' : isSel ? 'bg-ink' : 'bg-transparent'}`} />
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(r.ref)}
                      className="-mx-2 -my-2 flex min-h-11 flex-col items-start justify-center rounded-sm px-2 text-left transition-colors hover:text-blue"
                      aria-pressed={isSel}
                    >
                      <span className="tnum font-mono text-[14px] font-bold">{r.ref}</span>
                      <span className="whitespace-nowrap font-mono text-[11px] text-ink-2">{shortHex(r.txHash, 6, 4)}</span>
                    </button>
                  ) : (
                    <span className="tnum font-mono text-[14px] font-bold">{r.ref}</span>
                  )}
                </td>
                <td className="px-4 py-3 align-top text-[14px] text-ink">{r.controllerName.replace(' (fictional)', '').replace(' Co.', '')}</td>
                <td className="px-4 py-3 align-top">
                  {problem && r.dbValue ? (
                    <span className="flex items-start gap-2 font-mono text-[13px]">
                      <span
                        className={`mt-px flex size-4 shrink-0 items-center justify-center rounded-full ${bad ? 'bg-bad' : 'bg-pending'} text-white`}
                        aria-label={bad ? 'changed after sealing' : 'not sealed'}
                      >
                        {altered ? <IconX size={10} strokeWidth={3} /> : <IconMinus size={10} strokeWidth={3} />}
                      </span>
                      <span className={bad ? 'font-bold text-bad' : 'font-bold text-pending'}>
                        {f ? <span className="font-normal text-ink-2">{f}: </span> : null}
                        {humanValue(r.dbValue)}
                      </span>
                    </span>
                  ) : (
                    <span className="font-mono text-[13px] text-ink-3">same as chain</span>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  {problem && r.chainValue && r.chainValue !== '—' ? (
                    <span className="flex items-start gap-2 font-mono text-[13px]">
                      <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-ok text-white" aria-label="sealed value">
                        <IconCheck size={10} strokeWidth={3} />
                      </span>
                      <span className="text-ink">
                        {f ? <span className="text-ink-2">{f}: </span> : null}
                        {humanValue(r.chainValue)}
                      </span>
                    </span>
                  ) : (
                    <span className="tnum font-mono text-[13px] text-ink-3">
                      {r.blockNumber ? `block ${r.blockNumber.toLocaleString('en-US')}` : 'nothing sealed'}
                    </span>
                  )}
                </td>
                <td className="w-px whitespace-nowrap px-4 py-3 align-top">
                  <span key={r.status} className={`inline-flex ${flash ? 'rg-badge-stamp' : ''}`}>
                    <Badge kind={KIND[r.status]} size="sm" />
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
