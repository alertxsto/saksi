import { AppHeader } from '@/components/ui/AppHeader'
import { Chip } from '@/components/ui/Chip'
import { IconLock } from '@/components/ui/icons'

// Presenter console for the live demo. Not linked from any navigation; the API calls need DEMO_ADMIN_TOKEN.
export default function OperatorLayout({ children }: LayoutProps<'/operator'>) {
  return (
    <>
      <AppHeader
        role="Operator"
        nav={[]}
        right={
          <Chip icon={<IconLock size={12} />} tone="pending">
            Presenter only · synthetic data
          </Chip>
        }
      />
      <main id="main" className="px-4 pb-20 pt-8 md:px-6 md:pt-10">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </>
  )
}
