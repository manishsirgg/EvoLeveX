'use client'

import { useState } from 'react'

import type { PublicStoreImage } from '@/lib/storefront'

export function StorefrontGallery({ images, productName }: { images: PublicStoreImage[]; productName: string }) {
  const [activeId, setActiveId] = useState(images[0]?.id ?? '')
  const active = images.find((image) => image.id === activeId) ?? images[0]
  return (
    <div className="store-gallery">
      <div className="store-gallery-main">
        {active ? (
          // Signed private Storage URLs are intentionally rendered without the image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active.url} alt={active.alt} width="1000" height="1250" fetchPriority="high" />
        ) : <span className="store-image-placeholder" aria-label="Product image unavailable">Evo Store</span>}
      </div>
      {images.length > 1 && <div className="store-gallery-thumbs" role="group" aria-label={`${productName} image gallery`}>
        {images.map((image) => <button key={image.id} type="button" onClick={() => setActiveId(image.id)} aria-pressed={image.id === active?.id} aria-label={`Show ${image.alt}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="" width="120" height="150" loading="lazy" />
        </button>)}
      </div>}
    </div>
  )
}
