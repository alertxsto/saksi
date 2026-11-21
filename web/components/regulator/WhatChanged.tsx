'use client'

import { fieldLabel, humanValue } from './labels'
import dynamic from 'next/dynamic'
import { Badge } from '@/components/ui/Badge'
import { FingerprintChip } from '@/components/ui/FingerprintChip'
import { IconArrowUpRight, IconCheck, IconX } from '@/components/ui/icons'
import type { ShapeName } from '@/components/landing/lattice/shapes'
import { explorerLink, type WatchRowView } from '@/lib/data'
import { formatWIB } from '@/lib/format'
import { EXPLORER_HOST } from './explorer'
import { Scramble } from './Scramble'

const LatticeObject = dynamic(() => import('@/components/landing/lattice/LatticeObject').then((m) => m.LatticeObject), {
  ssr: false,
  loading: () => <div className="aspect-square w-full" />,
})

/** 07:03 UTC: the second clock in the time block (Mobbin R2, Railway audit drawer). */
const utc = (ms: number) => `${new Date(ms).toISOString().slice(11, 16)} UTC`


/** The lattice object for each verdict: the landing's receipt → ALTERED morph, a check for MATCH. */
function shapeFor(focus: WatchRowView | undefined): { shape: ShapeName; param?: number } {
  if (!focus) return { shape: 'fingerprint' }
  switch (focus.status) {
    case 'MATCH':
      return { shape: 'check', param: 1 }
    case 'ALTERED':
    case 'DELETED':
      return { shape: 'alert' }
    case 'NOT_ANCHORED':
      return { shape: 'block' }
  }
}

/**
 * "What changed" (Watch climax): the landing ALTERED moment as a vault slab. The lattice object morphs
 * to the red receipt, an ALTERED / DELETED stamp lands on it, and the diff ledger reads
 * database-says (red ×) against chain-sealed (ice ✓). MATCH / nothing-yet states stay calm and neutral.
 */
export function WhatChanged({ focus, note, known }: { focus: WatchRowView | undefined; note: string; known: boolean }) {
  const bad = focus?.status === 'ALTERED' || focus?.status === 'DELETED'
  const s = shapeFor(focus)
  const hitKey = focus ? `${focus.ref}-${focus.status}-${focus.changedAt ?? ''}` : 'none'

  return (
    <section className="vault grain relative overflow-hidden rounded-xl bg-vault text-vault-ink md:max-xl:grid md:max-xl:grid-cols-2" aria-label="What changed">
      {bad ? <span key={hitKey} aria-hidden="true" className="rg-vault-hit pointer-events-none absolute inset-0 z-[2] rounded-[inherit]" /> : null}
      <div className="relative z-[1] grid grid-cols-[minmax(0,156px)_minmax(0,1fr)] items-center gap-5 p-5 md:p-6">
        <div className="relative">
          <LatticeObject
            shape={s.shape}
            param={s.param}
            title={focus ? `${focus.ref}: ${focus.status.replace('_', ' ')}` : 'Nothing compared yet'}
          />
          {bad ? (
            <span
              key={hitKey}
              aria-hidden="true"
              className="rg-stamp pointer-events-none absolute left-1/2 top-[74%] whitespace-nowrap rounded-md border-[2.5px] border-bad-v bg-vault/85 px-2.5 py-0.5 font-mono text-[15px] font-bold tracking-[0.12em] text-bad-v"
            >
              {focus?.status}
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="label text-[11px] text-vault-ink-2">What changed</p>
          <p className="tnum mt-1.5 truncate font-mono text-[26px] font-bold leading-none tracking-[-0.01em] text-vault-ink">
            {focus ? <Scramble value={focus.ref} /> : known ? 'Nothing' : '—'}
          </p>
          {focus ? <p className="mt-2 truncate text-[14px] text-vault-ink-2">{focus.controllerName.replace(' (fictional)', '')}</p> : null}
          {focus ? <Badge kind={focus.status} onVault size="sm" className="mt-3" /> : null}
        </div>
      </div>

      <div className="relative z-[1] border-t border-vault-line px-5 pb-5 pt-1 md:px-6 md:max-xl:border-l md:max-xl:border-t-0 md:max-xl:pt-3">
        {focus && focus.status !== 'MATCH' ? (
          <>
            <dl className="font-mono text-[13px]">
              {focus.changedAt ? (
                <div className="flex min-h-11 items-center justify-between gap-3 border-b border-vault-line">
                  <dt className="label text-[11px] text-vault-ink-2">Detected</dt>
                  <dd className="text-right text-vault-ink">
                    {formatWIB(focus.changedAt)} <span className="text-vault-ink-2">· {utc(focus.changedAt)}</span>
                  </dd>
                </div>
              ) : null}
              <div className="flex min-h-11 items-center justify-between gap-3 border-b border-vault-line">
                <dt className="label text-[11px] text-vault-ink-2">Field</dt>
                <dd className="text-vault-ink">{fieldLabel(focus.field) ?? '—'}</dd>
              </div>
              <div className={`relative -mx-3 my-2 rounded-md px-3 py-3 ${bad ? 'bg-bad-v/12' : ''}`}>
                <dt className={`label flex items-center gap-2 text-[11px] ${bad ? 'text-bad-v' : 'text-pending-v'}`}>
                  <IconX size={12} strokeWidth={2.8} /> Database says
                </dt>
                <dd className="mt-1.5 break-words pl-5 text-[15px] text-vault-ink">
                  {focus.dbValue ? <Scramble value={humanValue(focus.dbValue)} /> : '—'}
                </dd>
              </div>
              <div className="relative -mx-3 rounded-md px-3 py-3">
                <dt className="label flex items-center gap-2 text-[11px] text-ice">
                  <IconCheck size={12} strokeWidth={2.8} /> Chain sealed
                </dt>
                <dd className="mt-1.5 break-words pl-5 text-[15px] text-vault-ink">{focus.chainValue ? humanValue(focus.chainValue) : '—'}</dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-vault-line pt-2">
              <span className="flex flex-col">
                <span className="label text-[11px] text-vault-ink-2">Sealed tx</span>
                <span className="tnum font-mono text-[11px] text-vault-ink-2">
                  log {focus.logIndex}
                  {focus.blockNumber ? ` · block ${focus.blockNumber.toLocaleString('en-US')}` : ''}
                </span>
              </span>
              <span className="flex items-center">
                <FingerprintChip value={focus.txHash} kind="none" onVault label="sealed transaction" />
                <a
                  href={explorerLink('tx', focus.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open sealed transaction on ${EXPLORER_HOST} (new tab)`}
                  className="-my-2.5 -mr-2.5 flex h-11 w-11 items-center justify-center rounded-sm text-vault-ink-2 transition-colors hover:bg-vault-2 hover:text-ice"
                >
                  <IconArrowUpRight size={15} />
                </a>
              </span>
            </div>
          </>
        ) : (
          <p className="pt-4 text-[14px] leading-relaxed text-vault-ink-2">{focus ? 'This row matches its sealed fingerprint.' : note}</p>
        )}
      </div>
    </section>
  )
}
