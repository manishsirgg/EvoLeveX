import type { Metadata } from 'next'
import Link from 'next/link'

import { formatMoney } from '@/lib/currency'
import { getCurrencyPreference } from '@/lib/currency-preference'
import { resolveStorefrontPrice } from '@/lib/fx/storefront-price'
import { getPublicVaultCatalog, type PublicVaultCatalogProduct } from '@/lib/vault'

export const metadata: Metadata = {
  title: 'Evo Vault — Books, Guides & Courses',
  description: 'Explore EvoLeveX books, practical guides and courses built for men committed to deliberate growth and real-world application.',
  alternates: { canonical: 'https://evolevex.com/vault' },
}

type CatalogProduct = PublicVaultCatalogProduct & { formattedPrice: string }

function kindLabel(kind: CatalogProduct['kind']) {
  return kind === 'course' ? 'Course' : 'Book'
}

function modeLabel(mode: string) {
  if (mode === 'digital') return 'Digital'
  if (mode === 'physical') return 'Physical'
  if (mode === 'hybrid') return 'Hybrid'
  return null
}

function VaultCover({ product }: { product: CatalogProduct }) {
  return product.coverImageUrl ? (
    // Public catalog imagery is supplied by the existing Supabase image infrastructure.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={product.coverImageUrl} alt={`Cover of ${product.name}`} />
  ) : (
    <div className="vault-catalog-cover-placeholder">
      <span>Evo Vault</span>
      <strong>{product.name}</strong>
    </div>
  )
}

function ProductCard({ product }: { product: CatalogProduct }) {
  const href = `/vault/${encodeURIComponent(product.slug)}`
  const format = modeLabel(product.productMode)

  return (
    <article className="vault-catalog-card">
      <Link href={href} className="vault-catalog-card-cover" aria-label={`View ${product.name}`}>
        <VaultCover product={product} />
      </Link>
      <div className="vault-catalog-card-copy">
        <div className="vault-catalog-card-meta">
          <span>{product.category?.name ?? 'Evo Vault'}</span>
          <span>{kindLabel(product.kind)}{format ? ` · ${format}` : ''}</span>
        </div>
        <h3><Link href={href}>{product.name}</Link></h3>
        {product.shortDescription && <p>{product.shortDescription}</p>}
        <div className="vault-catalog-card-footer">
          <strong>{product.formattedPrice}</strong>
          <Link href={href}>View {kindLabel(product.kind)} <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </article>
  )
}

function CatalogState({ error = false }: { error?: boolean }) {
  return (
    <section className="vault-catalog-state" aria-live="polite">
      <span aria-hidden="true">{error ? '!' : '01'}</span>
      <div>
        <p className="section-index">{error ? 'Catalog unavailable' : 'Collection in progress'}</p>
        <h2>{error ? 'The Vault is temporarily closed.' : 'The next tools are being forged.'}</h2>
        <p>{error
          ? 'We could not load the collection right now. Please refresh or return shortly.'
          : 'The foundational Evo Vault collection is being curated. Return soon for practical books, guides and courses.'}</p>
      </div>
    </section>
  )
}

export default async function VaultPage() {
  const [catalog, selectedCurrency] = await Promise.all([
    getPublicVaultCatalog(),
    getCurrencyPreference(),
  ])

  const products = await Promise.all(catalog.products.map(async (product) => {
    const price = await resolveStorefrontPrice({
      baseAmount: product.price,
      baseCurrency: product.currency,
      selectedCurrency,
    })
    return { ...product, formattedPrice: formatMoney(price.amount, price.currency) }
  }))
  const featured = products.filter((product) => product.isFeatured)

  return (
    <main className="vault-catalog-page">
      <header className="vault-catalog-hero">
        <p className="section-kicker">Knowledge / Application</p>
        <h1>Evo <em>Vault</em></h1>
        <p>Books, guides and courses engineered for practical application—built to help men think clearly, act deliberately and evolve with purpose.</p>
      </header>

      {catalog.hasError ? <CatalogState error /> : products.length === 0 ? <CatalogState /> : (
        <>
          {featured.length > 0 && (
            <section className="vault-featured" aria-labelledby="vault-featured-title">
              <div className="vault-catalog-section-heading">
                <div><p className="section-index">Featured</p><h2 id="vault-featured-title">Start here.</h2></div>
                <p>Selected tools for deeper work and immediate, real-world application.</p>
              </div>
              <div className="vault-featured-grid">
                {featured.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            </section>
          )}

          <section className="vault-collection" aria-labelledby="vault-collection-title">
            <div className="vault-catalog-section-heading">
              <div><p className="section-index">The collection</p><h2 id="vault-collection-title">Built to be used.</h2></div>
              <p>{products.length} {products.length === 1 ? 'resource' : 'resources'} for the work that happens beyond inspiration.</p>
            </div>
            <div className="vault-catalog-grid">
              {products.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
