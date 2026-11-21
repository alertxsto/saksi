'use client'

import { useParams } from 'next/navigation'
import { SystemMeta } from './SystemScreen'

/** Echoes the route params the visitor asked for (not-found files receive no props). Renders nothing without them. */
export function RequestedRef({ label, params }: { label: string; params: string[] }) {
  const all = useParams<Record<string, string | string[]>>()
  const parts = params.map((p) => all?.[p]).flatMap((v) => (Array.isArray(v) ? v : v ? [v] : []))
  if (!parts.length) return null
  return <SystemMeta label={label}>{parts.map(safeDecode).join(' · ')}</SystemMeta>
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}
