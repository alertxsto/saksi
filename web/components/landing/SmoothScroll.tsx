'use client'

import { useEffect } from 'react'
import { REDUCED_QUERY, tick } from '@/lib/motion/scroll'

/**
 * Lenis inertia (contentarchitecture uses Lenis 1.3 with the default lerp .1). Off under reduced motion
 * and on touch (syncTouch false keeps native momentum). Anchor links glide with a nav-height offset.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia(REDUCED_QUERY).matches) return
    let stop = () => {}
    let alive = true
    import('lenis').then(({ default: Lenis }) => {
      if (!alive) return
      const lenis = new Lenis({
        lerp: 0.1,
        wheelMultiplier: 0.9,
        syncTouch: false,
        allowNestedScroll: true,
        anchors: { offset: -88, duration: 1.2 },
        autoRaf: true,
      })
      lenis.on('scroll', tick)
      stop = () => lenis.destroy()
    })
    return () => {
      alive = false
      stop()
    }
  }, [])
  return null
}
