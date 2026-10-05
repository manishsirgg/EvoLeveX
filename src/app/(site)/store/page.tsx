import type { Metadata } from 'next'
import Link from 'next/link'

import { StorefrontProductCard } from '@/components/store/storefront-product-card'
import { getCurrencyPreference } from '@/lib/currency-preference'
import { getPublicStoreCatalog } from '@/lib/storefront'

export const metadata: Metadata = {
  title: 'Evo Store — Physical Merchandise',
  description: 'Purposeful EvoLeveX merchandise and everyday essentials designed for deliberate living.',
  alternates: { canonical: 'https://evolevex.com/store' },
  openGraph: { title: 'Evo Store — Physical Merchandise', url: 'https://evolevex.com/store', type: 'website', images: [{ url: '/favicon.ico', alt: 'EvoLeveX' }] },
}

export default async function StorePage({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const rawCategory = (await searchParams).category
  const selectedCategory = typeof rawCategory === 'string' && rawCategory.trim() ? rawCategory : undefined
  const currency = await getCurrencyPreference()
  const catalog = await getPublicStoreCatalog(currency, selectedCategory)
  const featured = catalog.products.filter((product) => product.isFeatured)
  const collection = catalog.products.filter((product) => !product.isFeatured)
  const emptyMessage = selectedCategory
    ? 'No products are currently available in this category.'
    : 'The Store collection is being prepared.'

  return <main className="store-page">
    <header className="store-hero"><p className="section-kicker">Objects / Intention</p><h1>Evo <em>Store</em></h1><p>Purposeful merchandise and EvoLeveX essentials for men who value standards in every detail.</p></header>
    {catalog.categories.length > 0 && <nav className="store-categories" aria-label="Store categories">
      <Link href="/store" aria-current={!selectedCategory ? 'page' : undefined}>All</Link>
      {catalog.categories.map((category) => <Link key={category.id} href={`/store?category=${encodeURIComponent(category.slug)}`} aria-current={selectedCategory === category.slug ? 'page' : undefined}>{category.name}</Link>)}
    </nav>}
    {catalog.hasError ? <section className="store-empty"><h2>The Store is temporarily unavailable.</h2><p>Please try again shortly.</p></section>
      : catalog.products.length === 0 ? <section className="store-empty"><h2>{emptyMessage}</h2></section> : <>
        {featured.length > 0 && <section className="store-section" aria-labelledby="store-featured"><div className="store-section-heading"><p className="section-index">Featured</p><h2 id="store-featured">Selected essentials.</h2></div><div className="store-grid">{featured.map((product) => <StorefrontProductCard key={product.id} product={product} />)}</div></section>}
        {collection.length > 0 && <section className="store-section" aria-labelledby="store-collection"><div className="store-section-heading"><p className="section-index">The collection</p><h2 id="store-collection">Made with intention.</h2></div><div className="store-grid">{collection.map((product) => <StorefrontProductCard key={product.id} product={product} />)}</div></section>}
      </>}
  </main>
}
