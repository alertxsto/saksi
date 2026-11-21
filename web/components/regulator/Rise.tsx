'use client'

import { useEffect, useRef, type ElementType } from 'react'
import { Heading } from '@/components/landing/Words'

/**
 * The landing `Heading` (zaro word rise) for app screens. The landing flips `data-shown` with one
 * page-wide RevealRoot; app screens mount headings after data loads, so each one flips itself on the
 * next frame. Without JS or with reduced motion the words are simply there (globals.css).
 */
export function RiseHeading(props: {
  as?: ElementType
  lead: string
  tail?: string
  className?: string
  tailClass?: string
  id?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector('[data-words]')
    if (!el) return
    const raf = requestAnimationFrame(() => el.setAttribute('data-shown', ''))
    return () => cancelAnimationFrame(raf)
  }, [props.lead, props.tail])
  return (
    <span ref={ref} className="contents">
      <Heading {...props} />
    </span>
  )
}
