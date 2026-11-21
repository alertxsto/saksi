'use client'

import { useEffect } from 'react'

const SELECTOR = '[data-words]:not([data-shown]),[data-stagger]:not([data-shown]),[data-reveal]:not([data-shown])'

/**
 * RevealRoot for app screens: the console mounts its content late (Suspense, wallet states, gallery
 * frames), so besides the first scan a MutationObserver picks up every [data-words] / [data-stagger] /
 * [data-reveal] node added later and flips data-shown once it is on screen. CSS in globals.css owns the
 * motion; without JS or with reduced motion everything is simply visible.
 */
export function ConsoleReveal() {
  useEffect(() => {
    const seen = new WeakSet<Element>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
            e.target.setAttribute('data-shown', '')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -40px 0px' },
    )
    let raf = 0
    const scan = () => {
      raf = 0
      document.querySelectorAll(SELECTOR).forEach((n) => {
        if (seen.has(n)) return
        seen.add(n)
        io.observe(n)
      })
    }
    scan()
    const mo = new MutationObserver(() => {
      if (!raf) raf = requestAnimationFrame(scan)
    })
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(raf)
      mo.disconnect()
      io.disconnect()
    }
  }, [])
  return null
}
