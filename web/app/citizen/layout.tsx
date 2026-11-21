import { WorkspaceSidebar } from '@/components/citizen-workspace/Sidebar'
import { CitizenShell } from './CitizenShell'
import { CitizenWorkspace } from './CitizenWorkspace'

export default function CitizenLayout({ children }: LayoutProps<'/citizen'>) {
  return (
    <CitizenShell sidebar={<WorkspaceSidebar />}>
      <CitizenWorkspace>{children}</CitizenWorkspace>
    </CitizenShell>
  )
}
