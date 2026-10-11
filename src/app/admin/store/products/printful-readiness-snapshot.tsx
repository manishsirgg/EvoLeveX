import type { StoreAdminProduct, StoreAdminProductImage, StoreAdminProductVariant } from '@/lib/admin-store'

type Props = {
  product: StoreAdminProduct
  images: StoreAdminProductImage[]
  variants: StoreAdminProductVariant[]
  imagesError: boolean
  variantsError: boolean
}

// Read-only evidence, NOT a fulfillment authorization or publication readiness grant.
export function PrintfulReadinessSnapshot({ product, images, variants, imagesError, variantsError }: Props) {
  if (product.slug !== 'printful-479728769') return null

  const ordered = [...images].sort((a,b) => a.sort_order - b.sort_order)
  const galleryConfigured = !imagesError && ordered.length === 3 &&
    ordered.every((image,index) => image.is_active && image.sort_order === index) &&
    ordered.filter(image => image.is_primary).length === 1 &&
    ordered[0]?.is_primary === true
  const inactiveVariants = !variantsError && variants.length === 18 &&
    variants.every(variant => !variant.is_active)
  const activePriceEntries = variants.reduce((sum,variant) =>
    sum + variant.prices.filter(price => price.is_active).length, 0)
  const inventoryRecords = variants.filter(variant => variant.inventory_configured).length
  const safeDraft = product.publication_status === 'draft'
  return <section className="mt-8 border border-amber-300/30 p-5 sm:p-7" aria-labelledby="printful-readiness-title">
    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Printful · Read-only operational snapshot</p>
    <h2 id="printful-readiness-title" className="mt-2 text-xl font-semibold">POD product readiness</h2>
    <p className="mt-2 text-sm text-zinc-400">The three mockups are the gallery foundation, not proof that a customer order can be placed or fulfilled. No actions are enabled here.</p>
    <dl className="mt-5 grid gap-3 sm:grid-cols-2 text-sm">
      <div><dt className="text-zinc-400">Publication</dt><dd className="font-semibold">{safeDraft ? 'Draft — not published' : product.publication_status}</dd></div>
      <div><dt className="text-zinc-400">Gallery</dt><dd className="font-semibold">{imagesError ? 'Inspection unavailable' : galleryConfigured ? '3 ordered images; first is primary' : 'Needs review'}</dd></div>
      <div><dt className="text-zinc-400">Variants</dt><dd className="font-semibold">{variantsError ? 'Inspection unavailable' : inactiveVariants ? '18 of 18 inactive' : 'Needs review'}</dd></div>
      <div><dt className="text-zinc-400">Active price records</dt><dd className="font-semibold">{variantsError ? 'Unknown' : activePriceEntries}</dd></div>
      <div><dt className="text-zinc-400">Inventory records</dt><dd className="font-semibold">{variantsError ? 'Unknown' : `${inventoryRecords} of ${variants.length}`}</dd></div>
      <div><dt className="text-zinc-400">Fulfillment / checkout</dt><dd className="font-semibold text-amber-200">Not authorized; publication lock remains</dd></div>
    </dl>
    <p className="mt-5 text-sm text-amber-200">Next engineering gates: verify Printful landed costs, shipping destinations/rates, payment/webhook mapping, fulfillment and cancellation/returns workflows. Never interpret an inventory quantity as Printful live stock without a validated provider integration.</p>
  </section>
}
