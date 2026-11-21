'use client'

import type { CSSProperties } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { IconCopy, IconSpinner, IconX } from '@/components/ui/icons'
import { VaultSeal, type SealTone } from '@/components/ui/VaultSeal'
import { SITE_URL } from '@/lib/env'
import { controllerLinkForCode } from '@/lib/format'
import '@/app/citizen/stub-list.css'

// Minimal local pass for the list half (riset-ui/36 A). The ticket half owns the real one; take theirs on merge.

export type PassVerdict = 'ok' | 'checking' | 'tamper' | 'empty'

export type CitizenPassProps = {
  code: string
  verdict: PassVerdict
  title: string
  subtitle?: string
  size: 'full' | 'compact'
  onCopy?: () => void
}

const TONE: Record<PassVerdict, SealTone> = { ok: 'ok', checking: 'idle', tamper: 'bad', empty: 'idle' }

function Pill({ verdict }: { verdict: PassVerdict }) {
  const base = 'flex h-7 shrink-0 items-center gap-1.5 rounded-pill px-2.5 text-[13px]'
  if (verdict === 'checking')
    return (
      <span className={`${base} bg-vault-2 text-vault-ink`}>
        <IconSpinner size={12} /> Checking
      </span>
    )
  if (verdict === 'tamper')
    return (
      <span className={`${base} bg-bad-v/15 font-medium text-bad-v`}>
        <IconX size={12} strokeWidth={2.6} aria-hidden="true" /> Changed
      </span>
    )
  if (verdict === 'empty')
    return (
      <span className={`${base} bg-vault-2 text-vault-ink-2`}>
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ice" /> Waiting
      </span>
    )
  return (
    <span className={`${base} bg-vault-2 text-vault-ink`}>
      <span aria-hidden="true" className="sl-live h-1.5 w-1.5 rounded-full bg-ok-v" /> Live
    </span>
  )
}

/** The citizen's pass: vault slab, the live verdict on top, the code (Doto) and a QR on the tear-off stub. */
export function CitizenPass({ code, verdict, title, subtitle, size, onCopy }: CitizenPassProps) {
  const compact = size === 'compact'
  const notch = compact ? 104 : 184
  const tamper = verdict === 'tamper'
  return (
    <div className="sl-shadow">
      <section
        aria-label="Your receipts status"
        className={`sl-ticket grain relative overflow-hidden rounded-xl bg-vault text-vault-ink ${tamper ? 'ring-1 ring-inset ring-bad-v/40' : ''}`}
        style={{ '--notch': `${notch}px` } as CSSProperties}
      >
        <div className={`relative z-[1] flex flex-col ${compact ? 'p-4' : 'p-5'}`} style={{ height: notch }}>
          <div className="flex items-start justify-between gap-3">
            <div aria-hidden="true" className={`${compact ? 'h-10 w-10' : 'h-[54px] w-[54px]'} shrink-0 rounded-[14px] bg-vault-2 p-1.5`}>
              <VaultSeal tone={TONE[verdict]} grid={false} boost={1.6} />
            </div>
            <Pill verdict={verdict} />
          </div>
          <p
            aria-live="polite"
            className={`mt-auto font-semibold tracking-[-0.02em] ${tamper ? 'text-bad-v' : ''} ${compact ? 'line-clamp-2 text-[14px] leading-snug' : 'text-[21px] leading-[1.15]'}`}
          >
            {title}
          </p>
          {subtitle && !compact ? <p className="mt-1 text-[14px] leading-snug text-vault-ink-2">{subtitle}</p> : null}
        </div>
        <span aria-hidden="true" className="sl-perf absolute left-5 right-5 z-[1] text-vault-ink-2/50" style={{ top: notch - 1 }} />
        <div className={`relative z-[1] flex items-center gap-3 ${compact ? 'px-4 pb-4 pt-3.5' : 'gap-4 px-5 pb-5 pt-4'}`}>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onCopy}
              disabled={!code || !onCopy}
              aria-label={code ? `Copy your code ${code.split('').join(' ')}` : 'Loading code'}
              className="-m-1 flex min-h-11 flex-col items-start rounded-md p-1 text-left disabled:cursor-default"
            >
              <span className="flex items-center gap-1.5 text-[13px] text-vault-ink-2">
                Your code {onCopy && code ? <IconCopy size={12} className="text-ice" /> : null}
              </span>
              <span className={`doto mt-1.5 tracking-[0.06em] text-vault-ink ${compact ? 'text-[22px]' : 'text-[34px]'}`}>{code || '······'}</span>
            </button>
            {compact ? null : <p className="mt-1.5 text-[13px] leading-snug text-vault-ink-2">Show it to a company. Every access comes back here as a receipt.</p>}
          </div>
          {code ? (
            <div className="shrink-0 rounded-[10px] bg-card p-1.5">
              <QRCodeSVG
                value={controllerLinkForCode(SITE_URL, code)}
                size={compact ? 44 : 68}
                bgColor="#FBFAF7"
                fgColor="#1E1A16"
                level="M"
                title="QR code a company scans to send you receipts"
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
