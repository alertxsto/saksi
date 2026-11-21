'use client'

import { useEffect } from 'react'

/**
 * One IntersectionObserver (rootMargin −80px, once — zaro A.8) for every [data-words] headline and
 * [data-stagger] list on the page. CSS in globals.css owns the motion; this only flips data-shown.
 * Nodes already scrolled past (anchor jumps) are shown too.
 */
export function RevealRoot() {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-words]:not([data-shown]),[data-stagger]:not([data-shown])')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
            e.target.setAttribute('data-shown', '')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -80px 0px' },
    )
    nodes.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])
  return null
}
