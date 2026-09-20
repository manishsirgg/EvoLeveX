import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { Avatar } from './avatar'

type Profile = {
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  status: string
}

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/auth/login')

  const { data, error: profileError } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, bio, status')
    .eq('id', user.id)
    .maybeSingle()
  const profile = data as Profile | null
  const displayName = profile?.display_name || profile?.username || 'EvoLeveX member'

  return (
    <section aria-labelledby="account-title" className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Account overview</p>
        <h1 id="account-title" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Welcome back, {profile?.display_name?.split(' ')[0] || 'member'}.</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">Manage your identity and keep your EvoLeveX account secure.</p>
      </div>

      {profileError || !profile ? (
        <div role="alert" className="border border-amber-300/20 bg-amber-300/[0.05] p-5 text-sm leading-6 text-amber-100">
          Your account is active, but your profile could not be loaded. Refresh the page or contact support if this continues.
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
          <article className="border border-white/10 bg-zinc-900/60 p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <Avatar path={profile.avatar_url} name={displayName} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-2xl font-semibold text-white">{displayName}</h2>
                <p className="mt-1 text-sm text-zinc-400">{profile.username ? `@${profile.username}` : 'Username not set'}</p>
                <p className="mt-2 truncate text-sm text-zinc-500">{user.email}</p>
              </div>
              <Link href="/account/profile" className="button-light inline-flex items-center justify-center px-5 py-3 text-sm">Edit profile</Link>
            </div>
            <div className="mt-7 border-t border-white/10 pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">About</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300">{profile.bio || 'Add a short bio to shape your member profile.'}</p>
            </div>
          </article>

          <article className="border border-white/10 bg-zinc-900/40 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Account standing</p>
            <div className="mt-5 flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
              <span className="capitalize text-base font-medium text-white">{profile.status}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-400">Your account and security settings are available from this member area.</p>
            <Link href="/account/security" className="mt-6 inline-flex text-sm font-semibold text-amber-200 underline decoration-amber-300/50 underline-offset-4 hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300">Review security</Link>
          </article>
        </div>
      )}
    </section>
  )
}
