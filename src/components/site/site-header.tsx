import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { getAvatarPublicUrl } from '@/app/account/avatar'
import { MobileNavigation } from './mobile-navigation'
import { ecosystemLinks } from './site-links'

type HeaderProfile = {
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'EX'
}

export async function SiteHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile: HeaderProfile | null = null

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, username, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
    profile = data as HeaderProfile | null
  }

  const memberName = profile?.display_name || profile?.username || 'Member'
  const avatarUrl = getAvatarPublicUrl(profile?.avatar_url ?? null)

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-wordmark" aria-label="EvoLeveX home">EvoLeveX</Link>

        <nav aria-label="Primary navigation" className="site-desktop-nav">
          {ecosystemLinks.map((link) => (
            <Link key={link.href} href={link.href}>{link.label}</Link>
          ))}
        </nav>

        <div className="site-account-actions">
          {user ? (
            <Link href="/account" className="site-account-link" aria-label="Open member account">
              {avatarUrl ? (
                // Supabase Storage URLs are generated at runtime.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" />
              ) : (
                <span aria-hidden="true">{getInitials(memberName)}</span>
              )}
              <b>Account</b>
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="site-sign-in">Sign in</Link>
              <Link href="/auth/register" className="button button-primary">Join EvoLeveX</Link>
            </>
          )}
        </div>

        <MobileNavigation isSignedIn={Boolean(user)} />
      </div>
    </header>
  )
}
