'use client'

import Link from 'next/link'
import { useState } from 'react'

import { ecosystemLinks } from './site-links'
import { SocialLinks } from './social-links'

type MobileNavigationProps = {
  isSignedIn: boolean
}

export function MobileNavigation({ isSignedIn }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="site-mobile-nav">
      <button
        type="button"
        className="site-menu-trigger"
        aria-expanded={isOpen}
        aria-controls="mobile-site-navigation"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="sr-only">{isOpen ? 'Close' : 'Open'} navigation menu</span>
        <span aria-hidden="true" className="site-menu-icon">
          <i />
          <i />
        </span>
      </button>

      {isOpen ? (
        <nav id="mobile-site-navigation" aria-label="Mobile navigation" className="site-mobile-panel">
          <div className="site-mobile-links">
            {ecosystemLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)}>{link.label}</Link>
            ))}
          </div>
          <div className="site-mobile-socials">
            <p id="mobile-socials-label">Follow EvoLeveX</p>
            <SocialLinks labelledBy="mobile-socials-label" />
          </div>
          <div className="site-mobile-account">
            {isSignedIn ? (
              <Link className="button button-primary" href="/account">View account</Link>
            ) : (
              <>
                <Link className="button button-secondary" href="/auth/login">Sign in</Link>
                <Link className="button button-primary" href="/auth/register">Join EvoLeveX</Link>
              </>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  )
}
