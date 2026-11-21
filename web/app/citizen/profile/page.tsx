import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ProfileSkeleton } from '@/components/ui/Skeleton'
import { ProfileView } from './ProfileView'

export const metadata: Metadata = { title: 'Profile' }

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileView />
    </Suspense>
  )
}
