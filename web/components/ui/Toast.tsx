'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { IconAlert, IconCheck } from './icons'

type ToastItem = { id: number; text: string; tone: 'ok' | 'bad' | 'info' }
type Ctx = { toast: (text: string, tone?: ToastItem['tone']) => void }

const ToastContext = createContext<Ctx>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const toast = useCallback((text: string, tone: ToastItem['tone'] = 'ok') => {
    seq.current += 1
    const id = seq.current
    setItems((list) => [...list.slice(-2), { id, text, tone }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 2600)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8"
      >
        {items.map((t) => (
          <ToastView key={t.id} text={t.text} tone={t.tone} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** One toast pill. Exported so the dev gallery can show it without timers. */
export function ToastView({ text, tone = 'ok' }: { text: string; tone?: ToastItem['tone'] }) {
  return (
    <div className="anim-rise label flex min-h-11 items-center gap-2.5 rounded-lg bg-ink px-4 py-2.5 text-[12px] text-paper shadow-[0_8px_24px_-12px_rgba(30,26,22,.6)]">
      <span className={`flex h-5 w-5 items-center justify-center rounded-sm ${tone === 'bad' ? 'bg-bad-v text-ink' : 'bg-ice text-ink'}`}>
        {tone === 'bad' ? <IconAlert size={13} strokeWidth={2.4} /> : <IconCheck size={13} strokeWidth={2.6} />}
      </span>
      {text}
    </div>
  )
}
