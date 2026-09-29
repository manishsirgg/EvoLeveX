import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { VaultBuyNow } from '@/components/vault/vault-buy-now'
import { VaultProductCarousel, type CarouselImage } from '@/components/vault/vault-product-carousel'
import { formatMoney } from '@/lib/currency'
import { getCurrencyPreference } from '@/lib/currency-preference'
import { resolveStorefrontPrice } from '@/lib/fx/storefront-price'
import { getPublicVaultBook, vaultProductModeLabel, vaultProductUrl } from '@/lib/vault'
import { createClient } from '@/lib/supabase/server'
import { userOwnsVaultProduct } from '@/lib/vault-access'

type VaultBookPageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: VaultBookPageProps): Promise<Metadata> {
  const product = await getPublicVaultBook((await params).slug)
  if (!product) return {}

  const title = product.seoTitle?.trim() || product.name
  const description = product.seoDescription?.trim() || product.shortDescription?.trim() || undefined
  const canonical = vaultProductUrl(product.slug)
  const image = product.coverImageUrl?.trim()

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title,
      description,
      url: canonical,
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

export default async function VaultBookPage({ params }: VaultBookPageProps) {
  const [product, selectedCurrency] = await Promise.all([
    getPublicVaultBook((await params).slug),
    getCurrencyPreference(),
  ])
  if (!product) notFound()

  const modeLabel = vaultProductModeLabel(product.productMode)
  const displayPrice = await resolveStorefrontPrice({
    baseAmount: product.price,
    baseCurrency: product.currency,
    selectedCurrency,
  })
  const price = formatMoney(displayPrice.amount, displayPrice.currency)
  const description = product.description?.trim()
  const preview = product.book.previewText?.trim()
  const galleryImages = product.images.filter((image) => image.publicUrl !== product.coverImageUrl)
  const carouselImages: CarouselImage[] = [
    ...(product.coverImageUrl ? [{
      id: `cover-${product.id}`,
      src: product.coverImageUrl,
      alt: `Cover of ${product.name}`,
    }] : []),
    ...galleryImages.map((image) => ({
      id: image.id,
      src: image.publicUrl,
      alt: image.altText?.trim() || `${product.name} detail`,
    })),
  ]
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let isOwned = false
  if (user && product.productMode === 'digital') {
    isOwned = await userOwnsVaultProduct(supabase, user.id, product.id)
  }

  return (
    <main className="vault-product-page">
      <Link className="vault-product-back" href="/vault">← Back to Evo Vault</Link>

      <article className="vault-product-layout">
        <section className="vault-product-media" aria-label={`${product.name} imagery`}>
          <VaultProductCarousel images={carouselImages} productName={product.name} />
        </section>

        <section className="vault-product-panel" aria-labelledby="vault-product-title">
          <div className="vault-product-labels">
            <span>Evo Vault</span>
            {product.category && <span>{product.category.name}</span>}
          </div>
          <h1 id="vault-product-title">{product.name}</h1>
          {product.book.authorName && <p className="vault-product-author">By {product.book.authorName}</p>}
          {product.shortDescription && <p className="vault-product-deck">{product.shortDescription}</p>}

          <dl className="vault-product-details">
            <Detail label="Format" value={modeLabel} />
            {product.book.pageCount && <Detail label="Length" value={`${product.book.pageCount} pages`} />}
            {product.book.isbn && <Detail label="ISBN" value={product.book.isbn} />}
          </dl>

          <div className="vault-purchase-card">
            <p className="vault-purchase-label">Price</p>
            <p className="vault-product-price">{price}</p>
            {product.productMode === 'digital' ? (
              <VaultBuyNow productId={product.id} productName={product.name}
                returnPath={`/vault/${encodeURIComponent(product.slug)}`}
                isAuthenticated={Boolean(user)} isOwned={isOwned}
                displayAmount={displayPrice.amount} displayCurrency={displayPrice.currency} />
            ) : (
              <>
                <button className="button button-primary vault-buy-button" type="button" disabled>Unavailable</button>
                <p className="vault-purchase-status">Purchasing for this format is coming soon.</p>
              </>
            )}
          </div>
        </section>
      </article>

      {(description || preview) && (
        <div className="vault-product-reading">
          {description && (
            <section className="vault-product-description" aria-labelledby="vault-about-heading">
              <p className="section-index">About the book</p>
              <h2 id="vault-about-heading">Built for deliberate evolution.</h2>
              <div>{description}</div>
            </section>
          )}
          {preview && (
            <aside className="vault-product-preview" aria-labelledby="vault-preview-heading">
              <p className="section-index">Preview</p>
              <h2 id="vault-preview-heading">Inside the book</h2>
              <blockquote>{preview}</blockquote>
            </aside>
          )}
        </div>
      )}
    </main>
  )
}
