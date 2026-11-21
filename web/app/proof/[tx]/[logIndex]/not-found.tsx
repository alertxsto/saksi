import { NotFoundScreen } from '@/components/system/NotFoundScreen'

/** notFound() for a tx + log index with no sealed record. Renders inside the /proof layout (header + main). */
export default function ProofNotFound() {
  return <NotFoundScreen kind="proof" chrome="embedded" />
}
