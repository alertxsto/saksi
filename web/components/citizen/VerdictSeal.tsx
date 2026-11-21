'use client'

import { useEffect, useState } from 'react'
import { VaultSeal, type SealTone } from '@/components/ui/VaultSeal'
import { useHydrated } from '@/lib/hooks'

/**
 * The dot-matrix padlock as the hero of a verdict. On a live verdict it mounts in ice and, one frame
 * later, its edge dots sweep green / red / grey from the centre out (the VaultSeal tone transition in
 * globals.css), so the colour change is the moment instead of a static colour. `scan` adds the checking
 * sweep while the phone asks the chain. SSR / reduced motion: final tone, no sweep.
 */
export function VerdictSeal({ tone, scan = false, className = '' }: { tone: SealTone; scan?: boolean; className?: string }) {
  const hydrated = useHydrated()
  const [fresh] = useState(hydrated)
  const [armed, setArmed] = useState(!fresh)

  useEffect(() => {
    if (armed) return
    const id = window.setTimeout(() => setArmed(true), 90)
    return () => clearTimeout(id)
  }, [armed])

  return (
    <div className={`relative ${scan ? 'cz-scan' : ''} ${className}`} aria-hidden="true">
      <VaultSeal tone={armed ? tone : 'idle'} grid={false} boost={1.35} />
    </div>
  )
}
