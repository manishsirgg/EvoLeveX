import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { FloatingActions } from '@/components/site/floating-actions'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-shell">
      <SiteHeader />
      {children}
      <SiteFooter />
      <FloatingActions />
    </div>
  )
}
