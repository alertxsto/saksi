import { RegulatorChrome } from '@/components/regulator/Chrome'

export default function RegulatorLayout({ children }: LayoutProps<'/regulator'>) {
  return <RegulatorChrome>{children}</RegulatorChrome>
}
