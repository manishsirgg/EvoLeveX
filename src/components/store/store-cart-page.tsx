'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { SupportedCurrency } from '@/lib/currency'
import type { ResolvedStoreCartLine, StoreCartSummary } from '@/lib/store-cart-resolver'
import { useStoreCart } from './store-cart-provider'

type Resolution = { lines: ResolvedStoreCartLine[]; summary: StoreCartSummary }

function statusText(line: ResolvedStoreCartLine) {
  if (!line.product) return 'No longer available.'
  if (!line.price) return 'Not available in your selected currency.'
  if (line.availability === 'out_of_stock') return 'Sold out.'
  if (line.availability === 'unavailable') return 'Currently unavailable.'
  return 'In stock'
}

export function StoreCartPage({ currency }: { currency: SupportedCurrency }) {
  const { items, isHydrated, storageError, setQuantity, removeItem, clearCart } = useStoreCart()
  const [resolution, setResolution] = useState<Resolution | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const removeRefs = useRef(new Map<string, HTMLButtonElement>())
  const serializedItems = JSON.stringify(items)

  const resolve = useCallback((signal: AbortSignal) => {
    setError(null)
    return fetch('/api/store/cart/resolve', { method: 'POST', cache: 'no-store', signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) })
      .then(async (response) => {
        if (!response.ok) throw new Error('resolution_failed')
        return response.json() as Promise<Resolution>
      }).then(setResolution).catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError('We could not refresh your cart. Your items are still saved in this browser.')
      })
  // serializedItems intentionally provides stable content semantics.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedItems, currency, refresh])

  useEffect(() => {
    if (!isHydrated || items.length === 0) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => { void resolve(controller.signal) }, 200)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [isHydrated, items.length, resolve])

  if (!isHydrated) return <main className="store-cart-page" aria-busy="true"><p>Loading your Store cart…</p></main>
  if (items.length === 0) return <main className="store-cart-page"><div className="store-cart-empty"><p className="section-index">Evo Store</p><h1>Your Store cart is empty.</h1><Link className="button button-primary" href="/store">Continue shopping</Link></div></main>

  const lineById = new Map(resolution?.lines.map((line) => [line.variantId, line]))
  return <main className="store-cart-page">
    <header className="store-cart-heading"><p className="section-index">Evo Store</p><h1>Your cart</h1><p>Prices and availability are refreshed from the Store.</p></header>
    {storageError ? <p className="store-cart-warning" role="status">{storageError}</p> : null}
    {error ? <div className="store-cart-error" role="alert"><p>{error}</p><button className="button button-secondary" type="button" onClick={() => setRefresh((value) => value + 1)}>Retry</button></div> : null}
    <div className="store-cart-layout">
      <section className="store-cart-lines" aria-label="Cart items">
        {items.map((item, index) => {
          const line = lineById.get(item.variant_id)
          const name = line?.product?.name ?? 'Store item'
          const canIncrement = Boolean(line?.isEligible) && item.quantity < 10
          return <article className="store-cart-line" key={item.variant_id}>
            <div className="store-cart-image">{line?.image
              // Signed private Storage URLs are runtime values.
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={line.image.url} alt={line.image.alt} /> : <span className="store-image-placeholder">Evo Store</span>}</div>
            <div className="store-cart-identity">
              <h2>{line?.product ? <Link href={`/store/${encodeURIComponent(line.product.slug)}`}>{name}</Link> : name}</h2>
              {(line?.size || line?.color) ? <p>{[line.size && `Size ${line.size}`, line.color && `Color ${line.color}`].filter(Boolean).join(' · ')}</p> : null}
              {line?.sku ? <p className="store-sku">SKU {line.sku}</p> : null}
              <p className={`store-status store-status-${line?.availability ?? 'unavailable'}`}>{line ? statusText(line) : 'Refreshing…'}</p>
              {line?.price ? <p className="store-cart-unit">{line.price.formatted} each</p> : null}
            </div>
            <div className="store-cart-quantity">
              <span id={`quantity-${item.variant_id}`}>Quantity for {name}</span>
              <div>
                <button type="button" aria-label={`Decrease quantity for ${name}`} disabled={item.quantity <= 1} onClick={() => setQuantity(item.variant_id, item.quantity - 1)}>−</button>
                <input aria-labelledby={`quantity-${item.variant_id}`} type="number" inputMode="numeric" min="1" max="10" step="1" value={item.quantity}
                  onChange={(event) => { const value = Number(event.target.value); if (Number.isSafeInteger(value) && value >= 1 && value <= 10) setQuantity(item.variant_id, value) }} />
                <button type="button" aria-label={`Increase quantity for ${name}`} disabled={!canIncrement} onClick={() => setQuantity(item.variant_id, item.quantity + 1)}>+</button>
              </div>
              <button className="store-cart-remove" ref={(node) => { if (node) removeRefs.current.set(item.variant_id, node) }} type="button" aria-label={`Remove ${name} from cart`} onClick={() => {
                removeItem(item.variant_id)
                window.requestAnimationFrame(() => { const next = items[index + 1] ?? items[index - 1]; if (next) removeRefs.current.get(next.variant_id)?.focus() })
              }}>Remove</button>
            </div>
            <div className="store-cart-line-total"><span>Line total</span><strong>{line?.lineTotal?.formatted ?? '—'}</strong></div>
          </article>
        })}
      </section>
      <aside className="store-cart-summary" aria-label="Cart summary">
        <h2>Summary</h2><div><span>Eligible items</span><span>{resolution?.summary.eligibleItemCount ?? '—'}</span></div>
        <div className="store-cart-subtotal"><span>Subtotal</span><strong>{resolution?.summary.subtotal.formatted ?? '—'}</strong></div>
        <p>Only currently eligible items are included. Shipping and tax are not calculated here.</p>
        <Link className="button button-primary" href="/store">Continue shopping</Link>
        <button className="button button-secondary" type="button" onClick={() => setRefresh((value) => value + 1)}>Refresh cart</button>
        <button className="button button-danger" type="button" onClick={clearCart}>Clear cart</button>
      </aside>
    </div>
  </main>
}
