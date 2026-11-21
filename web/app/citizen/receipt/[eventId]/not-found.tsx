import { NotFoundScreen } from '@/components/system/NotFoundScreen'
import { TabBar } from '@/components/ui/TabBar'

/** notFound() for a receipt id that isn't in this profile. Renders inside the citizen column (CitizenShell). */
export default function ReceiptNotFound() {
  return (
    <>
      <NotFoundScreen kind="receipt" chrome="embedded" stack />
      <TabBar />
    </>
  )
}
