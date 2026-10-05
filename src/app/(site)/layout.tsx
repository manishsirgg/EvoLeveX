import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { FloatingActions } from '@/components/site/floating-actions'
import { StoreCartProvider } from '@/components/store/store-cart-provider'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreCartProvider><div className="site-shell">
      <SiteHeader />
      {children}
      <SiteFooter />
      <FloatingActions />
    </div></StoreCartProvider>
  )
}
