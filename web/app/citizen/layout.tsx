import { CitizenShell } from './CitizenShell'

export default function CitizenLayout({ children }: LayoutProps<'/citizen'>) {
  return <CitizenShell>{children}</CitizenShell>
}
