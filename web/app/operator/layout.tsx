import { AppHeader } from '@/components/ui/AppHeader'
import '@/app/controller/agency.css'

// Presenter console for the live demo. Not linked from any navigation; the API calls need DEMO_ADMIN_TOKEN.
export default function OperatorLayout({ children }: LayoutProps<'/operator'>) {
  return (
    <div className="ag-root min-h-dvh bg-paper">
      <AppHeader actor="operator" identity="Presenter · synthetic data" />
      <main id="main" className="px-4 pb-20 pt-6 md:px-8 md:pt-10">
        <div className="mx-auto w-full max-w-[1240px]">{children}</div>
      </main>
    </div>
  )
}
