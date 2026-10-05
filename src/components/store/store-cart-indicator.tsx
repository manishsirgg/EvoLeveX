'use client'

import Link from 'next/link'
import { useStoreCart } from './store-cart-provider'

export function StoreCartIndicator({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const { isHydrated, itemCount } = useStoreCart()
  const label = isHydrated && itemCount > 0 ? `Store cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : 'Store cart'
  return <Link href="/store/cart" className={mobile ? 'store-cart-link store-cart-link-mobile' : 'store-cart-link'} aria-label={label} onClick={onNavigate}>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 8H6M10 20h.01M17 20h.01" /></svg>
    {mobile ? <span>Cart</span> : null}
    {isHydrated && itemCount > 0 ? <b aria-hidden="true">{itemCount > 99 ? '99+' : itemCount}</b> : null}
  </Link>
}
