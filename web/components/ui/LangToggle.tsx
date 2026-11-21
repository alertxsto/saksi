'use client'

import { useEffect, useState } from 'react'
import { setLang, useLang, type Lang } from '@/lib/client/lang'

const LANGS: Lang[] = ['en', 'id']

/**
 * EN / ID segmented switch: a 32 px pill whose ink thumb slides to the active side (220 ms, enter easing).
 * The slide is enabled one frame after mount, so a page that loads in Indonesian does not animate on arrival.
 * Reduced motion: globals.css zeroes transitions.
 */
export function LangToggle({ className = '', size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  const lang = useLang()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const i = LANGS.indexOf(lang)
  return (
    <div
      role="group"
      aria-label="Language"
      data-no-translate
      className={`lang-toggle relative z-[1] grid shrink-0 grid-cols-2 items-center rounded-full border border-line bg-card/70 p-0.5 ${size === 'lg' ? 'h-11' : 'h-8'} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-ink ${ready ? 'transition-transform duration-[220ms] ease-[cubic-bezier(.2,.8,.2,1)]' : ''}`}
        style={{ transform: `translateX(${i * 100}%)` }}
      />
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          aria-label={l === 'en' ? 'English' : 'Bahasa Indonesia'}
          onClick={() => setLang(l)}
          className={`relative flex h-full items-center justify-center rounded-full font-mono ${size === 'lg' ? 'min-w-12 px-3 text-[13px]' : 'min-w-9 px-2 text-[12px]'} font-medium uppercase tracking-[0.04em] text-ink-3 transition-colors duration-[220ms] hover:text-ink aria-pressed:text-paper aria-pressed:hover:text-paper`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
