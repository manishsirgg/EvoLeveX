'use client'

import { useMemo, useState } from 'react'
import { useStoreCart } from './store-cart-provider'

import type { PublicStoreVariant, StoreAvailability } from '@/lib/storefront'

const availabilityLabel: Record<StoreAvailability, string> = {
  in_stock: 'In stock', out_of_stock: 'Sold out', unavailable: 'Currently unavailable',
}

function values(variants: PublicStoreVariant[], key: 'size' | 'color') {
  return [...new Set(variants.map((variant) => variant[key]).filter((value): value is string => Boolean(value)))]
}

export function StorefrontVariantSelector({ variants, initialVariantId }: { variants: PublicStoreVariant[]; initialVariantId: string }) {
  const initial = variants.find((variant) => variant.id === initialVariantId) ?? variants[0]
  const [selectedId, setSelectedId] = useState(initial?.id ?? '')
  const [lastChanged, setLastChanged] = useState<'size' | 'color'>('size')
  const [quantity, setQuantity] = useState(1)
  const [feedback, setFeedback] = useState('')
  const { addItem } = useStoreCart()
  const selected = variants.find((variant) => variant.id === selectedId) ?? initial
  const sizes = useMemo(() => values(variants, 'size'), [variants])
  const colors = useMemo(() => values(variants, 'color'), [variants])

  function choose(key: 'size' | 'color', value: string) {
    const other = key === 'size' ? 'color' : 'size'
    const retained = variants.find((variant) => variant[key] === value && variant[other] === selected?.[other])
    setLastChanged(key)
    setSelectedId((retained ?? variants.find((variant) => variant[key] === value))?.id ?? selectedId)
  }

  function optionExists(key: 'size' | 'color', value: string) {
    const other = key === 'size' ? 'color' : 'size'
    return variants.some((variant) => variant[key] === value && (!selected?.[other] || variant[other] === selected[other]))
  }

  if (!selected) return null
  return <div className="store-variant-panel">
    {sizes.length > 0 && <fieldset><legend>Size</legend><div className="store-options">
      {sizes.map((size) => { const exists = lastChanged === 'color' ? optionExists('size', size) : true; return <button key={size} type="button" aria-pressed={selected.size === size} disabled={!exists} title={exists ? undefined : 'This combination is not available'} onClick={() => choose('size', size)}>{size}</button> })}
    </div></fieldset>}
    {colors.length > 0 && <fieldset><legend>Color</legend><div className="store-options">
      {colors.map((color) => { const exists = lastChanged === 'size' ? optionExists('color', color) : true; return <button key={color} type="button" aria-pressed={selected.color === color} disabled={!exists} title={exists ? undefined : 'This combination is not available'} onClick={() => choose('color', color)}>{color}</button> })}
    </div></fieldset>}
    <div className="store-selected-commerce" aria-live="polite">
      <p className="store-detail-price">{selected.price ?? 'Not available in your selected currency.'}</p>
      {!selected.price && <p>Choose another currency from the currency selector to view configured prices.</p>}
      <p className={`store-status store-status-${selected.availability}`}>{availabilityLabel[selected.availability]}</p>
      {selected.sku && <p className="store-sku">SKU {selected.sku}</p>}
      <div className="store-add-controls">
        <label htmlFor="store-add-quantity">Quantity</label>
        <input id="store-add-quantity" type="number" inputMode="numeric" min="1" max="10" step="1" value={quantity} onChange={(event) => {
          const value = Number(event.target.value); if (Number.isSafeInteger(value) && value >= 1 && value <= 10) setQuantity(value)
        }} />
        <button className="button button-primary" type="button" disabled={!selected.price || selected.availability !== 'in_stock'} onClick={() => {
          const result = addItem(selected.id, quantity)
          setFeedback(result === 'added' ? `${quantity} ${quantity === 1 ? 'item' : 'items'} added to your cart.`
            : result === 'quantity_limit' ? 'This item is at the maximum quantity of 10.'
            : result === 'line_limit' ? 'Your cart has reached its 50-item limit.' : 'This item could not be added.')
        }}>Add to Cart</button>
      </div>
      {!selected.price ? <p>Not available in your selected currency.</p> : selected.availability === 'out_of_stock' ? <p>Sold out.</p> : selected.availability === 'unavailable' ? <p>Currently unavailable.</p> : null}
      <p className="store-add-feedback" aria-live="polite">{feedback}</p>
    </div>
  </div>
}
