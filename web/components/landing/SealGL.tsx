'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, type ComponentProps } from 'react'
import { VaultSeal } from '@/components/ui/VaultSeal'
import type { VaultSealGL as VaultSealGLType } from '@/components/ui/VaultSealGL'

type Props = ComponentProps<typeof VaultSealGLType>
const TONE = { idle: 'idle', match: 'ok', altered: 'bad' } as const

/** Same box as VaultSealGL's board, painted with the static SVG seal: SSR, no-JS, and loading state. */
function Fallback({ verdict = 'idle', grid = false, className = '', title }: Props) {
  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-xl border border-vault-line bg-vault grain ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      <div className="absolute inset-0">
        <VaultSeal tone={TONE[verdict]} grid={grid} />
      </div>
    </div>
  )
}

const VaultSealGL = dynamic(() => import('@/components/ui/VaultSealGL'), {
  ssr: false,
  loading: () => <Fallback />,
})

/**
 * Live WebGL seal, mounted only after first paint + idle so it never competes with LCP. Until then
 * (and without JS) the static SVG seal fills the exact same square box, so CLS stays 0.
 */
export function SealGL(props: Props) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const ric = window.requestIdleCallback
    if (ric) {
      const id = ric(() => setReady(true), { timeout: 1200 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(() => setReady(true), 300)
    return () => clearTimeout(id)
  }, [])
  return ready ? <VaultSealGL {...props} /> : <Fallback {...props} />
}
