'use client'

import { useEffect, useState } from 'react'

const whatsappHref = `https://wa.me/918989601701?${new URLSearchParams({
  text: 'Hi, I’m contacting you through EvoLeveX.com.',
})}`

export function FloatingActions() {
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    let frame = 0
    const updateVisibility = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setShowBackToTop(window.scrollY > 480))
    }
    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateVisibility)
    }
  }, [])

  function backToTop() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  return (
    <aside className="floating-actions" aria-label="Quick actions">
      <button
        type="button"
        className="floating-action floating-back-to-top"
        aria-label="Back to top"
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
        data-visible={showBackToTop}
        onClick={backToTop}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m6 14 6-6 6 6" />
        </svg>
      </button>
      <a
        className="floating-action floating-whatsapp"
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with EvoLeveX on WhatsApp"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.04 2a9.84 9.84 0 0 0-8.49 14.8L2 22l5.34-1.5A9.96 9.96 0 1 0 12.04 2Zm0 17.95a8 8 0 0 1-4.08-1.12l-.29-.17-3.17.89.85-3.09-.19-.31a7.89 7.89 0 1 1 6.88 3.8Zm4.34-5.91c-.24-.12-1.4-.69-1.62-.77-.21-.08-.37-.12-.53.12-.15.24-.61.77-.74.93-.14.16-.28.18-.52.06-.24-.12-1-.37-1.91-1.18a7.15 7.15 0 0 1-1.32-1.64c-.14-.24-.01-.37.1-.49.11-.1.24-.27.36-.41.12-.14.16-.24.24-.4.08-.15.04-.29-.02-.41-.06-.12-.53-1.28-.73-1.75-.19-.46-.39-.4-.53-.41h-.45a.87.87 0 0 0-.63.3c-.22.24-.83.81-.83 1.98 0 1.17.85 2.3.97 2.46.12.16 1.68 2.56 4.06 3.59.57.24 1.01.39 1.36.5.57.18 1.09.15 1.5.09.46-.07 1.4-.58 1.6-1.13.2-.55.2-1.03.14-1.13-.06-.1-.22-.16-.46-.28Z" />
        </svg>
      </a>
    </aside>
  )
}
