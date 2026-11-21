import { AppHeader } from '@/components/ui/AppHeader'
import { Chip } from '@/components/ui/Chip'
import { IconLock } from '@/components/ui/icons'

// Presenter console for the live demo. Not linked from any navigation; the API calls need DEMO_ADMIN_TOKEN.
export default function OperatorLayout({ children }: LayoutProps<'/operator'>) {
  return (
    <>
      <AppHeader
        role="Operator"
        area="operator"
        nav={[]}
        right={
          <Chip icon={<IconLock size={12} />} tone="pending">
            Presenter only · synthetic data
          </Chip>
        }
      />
      <main id="main" className="pb-20 pt-8 md:pt-10">
        <div className="ws">{children}</div>
      </main>
    </>
  )
}
