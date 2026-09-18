import Link from 'next/link'

import { ecosystemLinks } from './site-links'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <Link href="/" className="site-wordmark">EvoLeveX</Link>
          <p>Evolve. Elevate. Excel.</p>
        </div>
        <nav aria-label="Footer navigation" className="site-footer-nav">
          {ecosystemLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
        </nav>
        <div className="site-footer-account">
          <p>Member access</p>
          <Link href="/auth/login">Sign in</Link>
          <Link href="/account">Account</Link>
        </div>
      </div>
      <div className="site-footer-meta">
        <p>© {new Date().getFullYear()} EvoLeveX</p>
        <p>Built for deliberate evolution.</p>
      </div>
    </footer>
  )
}
