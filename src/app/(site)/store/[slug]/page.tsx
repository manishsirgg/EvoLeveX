import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StorefrontGallery } from '@/components/store/storefront-gallery'
import { StorefrontVariantSelector } from '@/components/store/storefront-variant-selector'
import { getCurrencyPreference } from '@/lib/currency-preference'
import { getPublicStoreProduct, storeProductUrl } from '@/lib/storefront'

type Props = { params: Promise<{ slug: string }> }

function metadataDescription(product: NonNullable<Awaited<ReturnType<typeof getPublicStoreProduct>>>) {
  return product.seoDescription?.trim() || product.shortDescription?.trim()
    || product.description?.replace(/\s+/g, ' ').trim().slice(0, 160) || undefined
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getPublicStoreProduct((await params).slug, await getCurrencyPreference())
  if (!product) notFound()
  const title = product.seoTitle?.trim() || product.name
  const description = metadataDescription(product)
  const canonical = storeProductUrl(product.slug)
  return {
    title, description, alternates: { canonical },
    openGraph: { type: 'website', title, description, url: canonical, images: [{ url: '/favicon.ico', alt: 'EvoLeveX' }] },
    twitter: { card: 'summary', title, description, images: ['/favicon.ico'] },
  }
}

export default async function StoreProductPage({ params }: Props) {
  const product = await getPublicStoreProduct((await params).slug, await getCurrencyPreference())
  if (!product) notFound()
  return <main className="store-detail-page">
    <nav className="store-breadcrumbs" aria-label="Breadcrumb"><Link href="/store">Evo Store</Link><span aria-hidden="true">/</span><Link href={`/store?category=${encodeURIComponent(product.category.slug)}`}>{product.category.name}</Link></nav>
    <article className="store-detail-layout">
      <section aria-label={`${product.name} imagery`}><StorefrontGallery images={product.images} productName={product.name} /></section>
      <section className="store-detail-panel" aria-labelledby="store-product-title">
        <p className="section-index">{product.category.name}</p><h1 id="store-product-title">{product.name}</h1>
        {product.shortDescription && <p className="store-detail-deck">{product.shortDescription}</p>}
        <StorefrontVariantSelector variants={product.variants} initialVariantId={product.initialVariantId} />
        <p className="store-availability-note">Availability is confirmed when checkout begins.</p>
      </section>
    </article>
    {product.description && <section className="store-description" aria-labelledby="store-description-title"><p className="section-index">Details</p><h2 id="store-description-title">Designed for deliberate living.</h2><p>{product.description}</p></section>}
  </main>
}
