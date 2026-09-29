'use client'

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

import { getCarouselIndex, type CarouselNavigation } from './carousel-state'

export type CarouselImage = {
  id: string
  src: string
  alt: string
}

type VaultProductCarouselProps = {
  images: CarouselImage[]
  productName: string
}

type PointerStart = { id: number; x: number; y: number }

export function VaultProductCarousel({ images, productName }: VaultProductCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const pointerStart = useRef<PointerStart | null>(null)
  const activeImage = images[activeIndex]
  const hasNavigation = images.length > 1

  function navigate(direction: CarouselNavigation) {
    setActiveIndex((current) => getCarouselIndex(current, images.length, direction))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const navigation = {
      ArrowLeft: 'previous',
      ArrowRight: 'next',
      Home: 'first',
      End: 'last',
    }[event.key] as CarouselNavigation | undefined

    if (!navigation || images.length === 0) return
    event.preventDefault()
    navigate(navigation)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!hasNavigation || event.pointerType === 'mouse') return
    pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start || start.id !== event.pointerId) return

    const horizontalDistance = event.clientX - start.x
    const verticalDistance = event.clientY - start.y
    if (Math.abs(horizontalDistance) < 48 || Math.abs(horizontalDistance) <= Math.abs(verticalDistance) * 1.25) return
    navigate(horizontalDistance > 0 ? 'previous' : 'next')
  }

  return (
    <div className="vault-carousel" onKeyDown={handleKeyDown}>
      <div
        className="vault-product-cover vault-carousel-stage"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { pointerStart.current = null }}
      >
        {activeImage ? (
          // Public catalog images are supplied by the existing Supabase image infrastructure.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={activeImage.id} src={activeImage.src} alt={activeImage.alt} />
        ) : (
          <div className="vault-cover-placeholder" aria-label="Cover image unavailable">
            <span>Evo Vault</span>
            <strong>{productName}</strong>
          </div>
        )}

        {hasNavigation && (
          <>
            <button className="vault-carousel-control vault-carousel-control--previous" type="button"
              onClick={() => navigate('previous')} aria-label="Show previous product image">
              <span aria-hidden="true">←</span>
            </button>
            <button className="vault-carousel-control vault-carousel-control--next" type="button"
              onClick={() => navigate('next')} aria-label="Show next product image">
              <span aria-hidden="true">→</span>
            </button>
          </>
        )}

        {activeImage && (
          <p className="vault-carousel-status" aria-live="polite" aria-atomic="true">
            Image {activeIndex + 1} / {images.length}
          </p>
        )}
      </div>

      {hasNavigation && (
        <div className="vault-gallery" aria-label="Product images">
          {images.map((image, index) => (
            <button key={image.id} type="button" className="vault-gallery-thumbnail"
              aria-label={`Show image ${index + 1}: ${image.alt}`}
              aria-current={index === activeIndex ? 'true' : undefined}
              onClick={() => setActiveIndex(index)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
