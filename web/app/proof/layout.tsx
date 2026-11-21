import { ProofFrame } from '@/components/proof/ProofFrame'

export default function ProofLayout({ children }: LayoutProps<'/proof'>) {
  return <ProofFrame>{children}</ProofFrame>
}
