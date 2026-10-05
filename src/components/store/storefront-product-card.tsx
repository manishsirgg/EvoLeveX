import Link from 'next/link'

import type { PublicStoreCatalogProduct } from '@/lib/storefront'

export function StorefrontProductCard({ product }: { product: PublicStoreCatalogProduct }) {
  return (
    <article className="store-card">
      <Link href={`/store/${encodeURIComponent(product.slug)}`} className="store-card-link">
        <span className="store-card-image">
          {product.image ? (
            // Signed private Storage URLs are intentionally rendered without the image optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image.url} alt={product.image.alt} width="720" height="900" loading="lazy" />
          ) : <span className="store-image-placeholder" aria-label="Product image unavailable">Evo Store</span>}
        </span>
        <span className="store-card-copy">
          <span className="section-index">{product.category.name}</span>
          <h3>{product.name}</h3>
          {product.shortDescription && <span className="store-card-description">{product.shortDescription}</span>}
          <span className="store-card-commerce"><strong>{product.priceLabel}</strong><span>{product.statusLabel}</span></span>
        </span>
      </Link>
    </article>
  )
}
