import type { ReactNode } from 'react'
import { CitizenReveal } from '@/components/citizen/motion'
import { Logo } from '@/components/ui/Logo'

/** Mobile column + header shared by the citizen layout and the /dev/states/citizen gallery frames. */
export function CitizenShell({ children, frame }: { children: ReactNode; frame?: boolean }) {
  return (
    <div className={frame ? 'flex min-h-full flex-col bg-paper' : 'min-h-dvh bg-paper-2/60'}>
      <div
        className={
          frame
            ? 'flex w-full flex-1 flex-col bg-paper'
            : 'mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-paper md:border-x md:border-line'
        }
      >
        <header className="no-print flex items-center justify-between border-b border-line px-4 py-1.5">
          <Logo href="/" sub="Citizen" />
          <span className="label text-[11px] text-ink-2">SYNTHETIC DEMO</span>
        </header>
        <main
          id={frame ? undefined : 'main'}
          className="flex flex-1 flex-col px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5"
        >
          <CitizenReveal>{children}</CitizenReveal>
        </main>
      </div>
    </div>
  )
}
