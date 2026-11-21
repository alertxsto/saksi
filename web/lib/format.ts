// Display helpers. No hashing here: every verdict comes from the browser verifier in lib/shared/verify.ts.
import { EVENT_LABELS, EVENT_TYPES, LEGAL_BASES, type LegalBasisKey, type ReceiptOpening } from './shared/types'

export const ETHERSCAN = 'https://sepolia.etherscan.io'

export function shortHex(h: string | null | undefined, head = 6, tail = 4): string {
  if (!h) return '—'
  return h.length > head + tail + 2 ? `${h.slice(0, head)}…${h.slice(-tail)}` : h
}

/** Sentence fragment for the citizen list: "shared your data with a third party". */
export function actSentence(eventType: number): string {
  return ['read your data', 'updated your data', 'exported your data', 'shared your data with a third party'][eventType] ?? 'used your data'
}

/** Upper-case verb for ledgers: READ / UPDATE / EXPORT / SHARED WITH THIRD PARTY. */
export function eventVerb(eventType: number): string {
  const name = EVENT_TYPES[eventType]
  return name ? EVENT_LABELS[name].toUpperCase() : 'UNKNOWN'
}

export function basisKeyFromHex(hex: string): LegalBasisKey | null {
  const clean = hex.replace(/^0x/, '').replace(/(00)+$/, '')
  let s = ''
  for (let i = 0; i < clean.length; i += 2) s += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16))
  return s in LEGAL_BASES ? (s as LegalBasisKey) : null
}

export function basisLabel(hex: string): string {
  const key = basisKeyFromHex(hex)
  return key ? LEGAL_BASES[key] : 'Unknown legal basis'
}

const WIB = 'Asia/Jakarta'

/** "21 Nov 14:03 WIB" */
export function formatWIB(iso: string | number): string {
  const d = typeof iso === 'number' ? new Date(iso) : new Date(iso)
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: WIB })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: WIB })
  return `${date} ${time} WIB`
}

export function timeAgo(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return `${s} s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

/** Bucket for the citizen timeline ruler. */
export function timeBucket(iso: string, now: number): 'NOW' | 'TODAY' | 'EARLIER' {
  const age = now - new Date(iso).getTime()
  if (age < 15 * 60_000) return 'NOW'
  const d = new Date(iso).toLocaleDateString('en-GB', { timeZone: WIB })
  const today = new Date(now).toLocaleDateString('en-GB', { timeZone: WIB })
  return d === today ? 'TODAY' : 'EARLIER'
}

/** Provider name for a narrow cell: "https://ethereum-sepolia-rpc.publicnode.com/x" → "publicnode". */
export function rpcLabel(rpc: string): string {
  let host = rpc
  try {
    host = new URL(rpc).hostname
  } catch {
    host = rpc.replace(/^[a-z]+:\/\//i, '').split(/[/:?#]/)[0] ?? rpc
  }
  if (/^[\d.]+$/.test(host)) return host
  const parts = host.split('.').filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 2] : host
}

/** Citizen codes as typed or scanned: upper case, letters and digits only, at most 6 characters. */
export function normalizeCitizenCode(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

/** What the profile QR encodes: the controller console with this citizen's code filled in. */
export function controllerLinkForCode(site: string, code: string): string {
  return `${site.replace(/\/+$/, '')}/controller?code=${encodeURIComponent(normalizeCitizenCode(code))}`
}

export function pad2(n: number): string {
  return String(Math.floor(Math.abs(n))).padStart(2, '0')
}

/** 41:12:08 */
export function hms(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`
}

// ------------------------------------------------------------------------------------------
// Proof links: /proof/[tx]/[logIndex]#<opening as base64url JSON>. The hash never reaches a server.
// ------------------------------------------------------------------------------------------

export function encodeOpening(opening: ReceiptOpening): string {
  const bytes = new TextEncoder().encode(JSON.stringify(opening))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeOpening(fragment: string): ReceiptOpening | null {
  try {
    const b64 = fragment.replace(/^#/, '').replace(/-/g, '+').replace(/_/g, '/')
    if (!b64) return null
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const value = JSON.parse(new TextDecoder().decode(bytes)) as Partial<ReceiptOpening>
    if (
      typeof value.eventId !== 'string' ||
      typeof value.purposeText !== 'string' ||
      typeof value.controllerName !== 'string' ||
      typeof value.eventType !== 'number' ||
      typeof value.legalBasisKey !== 'string'
    ) {
      return null
    }
    return value as ReceiptOpening
  } catch {
    return null
  }
}

export function proofPath(opening: ReceiptOpening): string {
  return `/proof/${opening.txHash ?? 'pending'}/${opening.logIndex ?? 0}#${encodeOpening(opening)}`
}
