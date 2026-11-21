'use client'

import { setLang, useLang, type Lang } from '@/lib/client/lang'

/** EN / ID segmented switch: a 32 px pill, the active side in ink. Sits beside the menu button. */
export function LangToggle({ className = '' }: { className?: string }) {
  const lang = useLang()
  return (
    <div
      role="group"
      aria-label="Language"
      data-no-translate
      className={`lang-toggle relative z-[1] flex h-8 shrink-0 items-center rounded-full border border-line bg-card/70 p-0.5 ${className}`}
    >
      {(['en', 'id'] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          aria-label={l === 'en' ? 'English' : 'Bahasa Indonesia'}
          onClick={() => setLang(l)}
          className="flex h-7 min-w-9 items-center justify-center rounded-full px-2 font-mono text-[12px] font-medium uppercase tracking-[0.04em] text-ink-3 transition-colors duration-150 hover:text-ink aria-pressed:bg-ink aria-pressed:text-paper"
        >
          {l}
        </button>
      ))}
    </div>
  )
}
