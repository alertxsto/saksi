import { AppHeader } from '@/components/ui/AppHeader'
import { Chip } from '@/components/ui/Chip'
import { IconShield } from '@/components/ui/icons'

const NAV = [
  { href: '/regulator', label: 'Breach notices' },
  { href: '/regulator/watch', label: 'Watch' },
]

export default function RegulatorLayout({ children }: LayoutProps<'/regulator'>) {
  return (
    <>
      <div className="contents print:hidden">
        <AppHeader
          role="Regulator"
          nav={NAV}
          right={
            <Chip icon={<IconShield size={12} />} tone="ink">
              Read-only · from chain
            </Chip>
          }
        />
      </div>
      <main id="main" className="px-4 pb-20 pt-8 md:px-6 md:pt-10">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </>
  )
}
