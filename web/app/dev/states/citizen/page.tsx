import type { Metadata } from 'next'
import { CitizenStatesGallery } from './Gallery'

export const metadata: Metadata = { title: 'Citizen states', robots: { index: false } }

export default function CitizenStatesPage() {
  return <CitizenStatesGallery />
}
