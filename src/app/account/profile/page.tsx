import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from './profile-form'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/auth/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name, username, bio, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <section aria-labelledby="profile-title" className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Member identity</p>
        <h1 id="profile-title" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Profile</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">Choose how you appear across the EvoLeveX experience.</p>
      </div>

      {profileError || !profile ? (
        <div role="alert" className="border border-rose-400/20 bg-rose-400/[0.05] p-5 text-sm leading-6 text-rose-200">Your profile is unavailable right now. Refresh the page or contact support if this continues.</div>
      ) : (
        <ProfileForm initialProfile={profile} />
      )}
    </section>
  )
}
