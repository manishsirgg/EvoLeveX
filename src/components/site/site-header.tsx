import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { getAvatarPublicUrl } from '@/app/account/avatar'
import { MobileNavigation } from './mobile-navigation'
import { SocialLinks } from './social-links'
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
  let unreadNotificationCount = 0

  if (user) {
    const [profileResult, notificationResult] = await Promise.all([
      supabase.from('profiles').select('display_name, username, avatar_url').eq('id', user.id).maybeSingle(),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
    ])
    profile = profileResult.data as HeaderProfile | null
    unreadNotificationCount = notificationResult.count ?? 0
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
          <SocialLinks className="site-header-socials" />
          {user ? (
            <>
              <Link href="/account/notifications" className="site-notification-link" aria-label={unreadNotificationCount ? `Notifications, ${unreadNotificationCount} unread` : 'Notifications'}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
                {unreadNotificationCount > 0 ? <span>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span> : null}
              </Link>
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
            </>
          ) : (
            <>
              <Link href="/auth/login" className="site-sign-in">Sign in</Link>
              <Link href="/auth/register" className="button button-primary">Join EvoLeveX</Link>
            </>
          )}
        </div>

        <MobileNavigation isSignedIn={Boolean(user)} unreadNotificationCount={unreadNotificationCount} />
      </div>
    </header>
  )
}
