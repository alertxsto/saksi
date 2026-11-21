import type { ReactNode } from 'react'
import { CitizenHeaderIdentity } from '@/components/citizen/CitizenIdentity'
import { CitizenReveal } from '@/components/citizen/motion'
import { LogoMark } from '@/components/ui/Logo'
import Link from 'next/link'

/**
 * Shell shared by the citizen layout and the /dev/states/citizen gallery frames.
 * Phone and tablet: the centred 430 px column with its header, which says who you are
 * ("Citizen · <name> (synthetic)" + Switch role, riset-ui/37 §3). From 1024 px of shell width
 * (container query, so gallery frames behave like real viewports) it becomes a workspace: the `sidebar`
 * on the left and a full-width main area; each page lays out its own desktop columns.
 * `name` forces the identity (gallery); the app reads it from the receipts cache.
 */
export function CitizenShell({ children, frame, sidebar, name }: { children: ReactNode; frame?: boolean; sidebar?: ReactNode; name?: string }) {
  return (
    <div className={`@container ${frame ? 'flex min-h-full flex-col bg-paper' : 'min-h-dvh bg-paper-2/60'}`}>
      <div className={`flex flex-1 ${frame ? '' : 'min-h-dvh'} @5xl:bg-paper`}>
        {sidebar}
        <div
          className={
            frame
              ? 'flex w-full min-w-0 flex-1 flex-col bg-paper'
              : 'mx-auto flex min-h-dvh w-full min-w-0 max-w-[430px] flex-col bg-paper md:border-x md:border-line @5xl:mx-0 @5xl:max-w-none @5xl:flex-1 @5xl:border-x-0'
          }
        >
          <header className="no-print flex items-center gap-3 border-b border-line px-4 py-1 @5xl:hidden">
            <Link href="/" aria-label="Saksi home" className="flex min-h-11 shrink-0 items-center">
              <LogoMark size={26} />
            </Link>
            <CitizenHeaderIdentity name={name} />
          </header>
          <main
            id={frame ? undefined : 'main'}
            className="flex flex-1 flex-col px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5 @5xl:p-0"
          >
            <CitizenReveal>{children}</CitizenReveal>
          </main>
        </div>
      </div>
    </div>
  )
}
