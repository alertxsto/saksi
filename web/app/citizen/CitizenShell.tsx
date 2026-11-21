import type { ReactNode } from 'react'
import { CitizenReveal } from '@/components/citizen/motion'
import { AppHeader } from '@/components/ui/AppHeader'

const NAV = [
  { href: '/citizen', label: 'Receipts' },
  { href: '/proof', label: 'Verify' },
  { href: '/citizen/profile', label: 'Profile' },
]

/**
 * Shell shared by the citizen layout and the /dev/states/citizen gallery frames.
 * The shared AppHeader on top at every width (role chip "Citizen", menu sheet with the three tabs and Switch
 * role); who you are lives in the sidebar footer (laptop) and on Profile, not in the header.
 * Phone and tablet: the centred 430 px column. From 1024 px of shell width (container query, so gallery
 * frames behave like real viewports) it becomes a workspace: the `sidebar` under the header on the left and a
 * full-width main area; each page lays out its own desktop columns.
 * `name` is kept for the gallery call sites (the sidebar reads the identity itself).
 */
export function CitizenShell({ children, frame, sidebar }: { children: ReactNode; frame?: boolean; sidebar?: ReactNode; name?: string }) {
  return (
    <div className={`@container ${frame ? 'flex min-h-full flex-col bg-paper' : 'min-h-dvh bg-paper-2/60'}`}>
      <AppHeader actor="citizen" nav={NAV} frame={frame} />
      <div className={`flex flex-1 ${frame ? '' : 'min-h-[calc(100dvh-var(--hdr))]'} @5xl:bg-paper`}>
        {sidebar}
        <div
          className={
            frame
              ? 'flex w-full min-w-0 flex-1 flex-col bg-paper'
              : 'mx-auto flex min-h-[calc(100dvh-var(--hdr))] w-full min-w-0 max-w-[430px] flex-col bg-paper md:border-x md:border-line @5xl:mx-0 @5xl:max-w-none @5xl:flex-1 @5xl:border-x-0'
          }
        >
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
