import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { getCarouselIndex } from '../src/components/vault/carousel-state.ts'

const componentPath = new URL('../src/components/vault/vault-product-carousel.tsx', import.meta.url)
const pagePath = new URL('../src/app/(site)/vault/[slug]/page.tsx', import.meta.url)

test('carousel navigation advances and wraps in both directions', () => {
  assert.equal(getCarouselIndex(0, 4, 'next'), 1)
  assert.equal(getCarouselIndex(3, 4, 'next'), 0)
  assert.equal(getCarouselIndex(3, 4, 'previous'), 2)
  assert.equal(getCarouselIndex(0, 4, 'previous'), 3)
})

test('carousel navigation supports first, last, and single-image products', () => {
  assert.equal(getCarouselIndex(2, 4, 'first'), 0)
  assert.equal(getCarouselIndex(1, 4, 'last'), 3)
  assert.equal(getCarouselIndex(0, 1, 'previous'), 0)
  assert.equal(getCarouselIndex(0, 1, 'next'), 0)
})

test('thumbnail selection is button-based, stateful, and accessible', async () => {
  const source = await readFile(componentPath, 'utf8')

  assert.match(source, /<button key=\{image\.id\} type="button"/)
  assert.match(source, /onClick=\{\(\) => setActiveIndex\(index\)\}/)
  assert.match(source, /const activeImage = images\[activeIndex\]/)
  assert.match(source, /aria-current=\{index === activeIndex \? 'true' : undefined\}/)
  assert.doesNotMatch(source, /<a\b/)
  assert.doesNotMatch(source, /target=["']_blank["']/)
})

test('controls are conditional and keyboard navigation includes arrows, Home, and End', async () => {
  const source = await readFile(componentPath, 'utf8')

  assert.match(source, /const hasNavigation = images\.length > 1/)
  assert.match(source, /\{hasNavigation && \(/)
  assert.match(source, /ArrowLeft: 'previous'/)
  assert.match(source, /ArrowRight: 'next'/)
  assert.match(source, /Home: 'first'/)
  assert.match(source, /End: 'last'/)
  assert.match(source, /aria-label="Show previous product image"/)
  assert.match(source, /aria-label="Show next product image"/)
})

test('server page retains fetching responsibilities and serializes cover before gallery images', async () => {
  const source = await readFile(pagePath, 'utf8')

  assert.match(source, /getPublicVaultBook\(\(await params\)\.slug\)/)
  assert.match(source, /getCurrencyPreference\(\)/)
  assert.match(source, /resolveStorefrontPrice\(/)
  assert.match(source, /createClient\(\)/)
  assert.match(source, /userOwnsVaultProduct\(/)
  assert.ok(source.indexOf('id: `cover-${product.id}`') < source.indexOf('...galleryImages.map'))
  assert.match(source, /<VaultProductCarousel images=\{carouselImages\}/)
  assert.doesNotMatch(source, /target=["']_blank["']/)
})
