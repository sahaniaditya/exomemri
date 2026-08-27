import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicProfileView from '@/components/public-profile/PublicProfileView'
import { getPublicProfile } from '@/lib/public-profile'

interface PublicProfilePageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params
  const profile = await getPublicProfile(username)
  if (!profile) {
    return {
      title: `${username} · exomemri`,
      description: 'A public exomemri learning profile.',
    }
  }
  return {
    title: `${profile.full_name} · exomemri`,
    description: `${profile.full_name}'s public learning profile on exomemri.`,
  }
}

// Deliberately no cookies()/token read anywhere on this page — it renders
// the same for every visitor, logged in or not. Access is gated entirely by
// the backend's opt-in profile_public flag, not by anything client-side.
export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params
  const profile = await getPublicProfile(username)
  if (!profile) notFound()

  return <PublicProfileView profile={profile} />
}
