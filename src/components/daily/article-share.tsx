'use client'

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'

type ArticleShareProps = { title: string; excerpt: string | null; url: string }

const subscribeToNativeShare = () => () => {}
const supportsNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const noNativeShare = () => false

function shareUrl(base: string, values: Record<string, string>) {
  const url = new URL(base)
  Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value))
  return url.toString()
}

function copyFallback(value: string) {
  const input = document.createElement('textarea')
  input.value = value
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (!copied) throw new Error('Copy failed')
}

export function ArticleShare({ title, excerpt, url }: ArticleShareProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const nativeShare = useSyncExternalStore(subscribeToNativeShare, supportsNativeShare, noNativeShare)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  async function useNativeShare() {
    setError('')
    try {
      await navigator.share({ title, text: excerpt?.trim() || undefined, url })
      setOpen(false)
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError('Sharing was unavailable. Choose another option below.')
    }
  }

  async function copyLink() {
    setError('')
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url)
      else copyFallback(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setError('Could not copy the link. You can still use another share option.')
    }
  }

  const text = `${title} ${url}`
  const destinations = [
    ['WHATSAPP', shareUrl('https://wa.me/', { text }), 'WA'],
    ['FACEBOOK', shareUrl('https://www.facebook.com/sharer/sharer.php', { u: url }), 'f'],
    ['X / TWITTER', shareUrl('https://twitter.com/intent/tweet', { text: title, url }), 'X'],
    ['LINKEDIN', shareUrl('https://www.linkedin.com/sharing/share-offsite/', { url }), 'in'],
    ['TELEGRAM', shareUrl('https://t.me/share/url', { url, text: title }), 'TG'],
    ['REDDIT', shareUrl('https://www.reddit.com/submit', { url, title }), 'R'],
  ] as const
  const email = `mailto:?${new URLSearchParams({ subject: title, body: `I thought you might enjoy this Evo Daily article:\n\n${url}` })}`

  return <div className="article-share" ref={rootRef}>
    <button ref={triggerRef} type="button" className="article-bookmark" aria-label="Share this article" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => { setOpen((value) => !value); setError('') }}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></svg><span>SHARE</span>
    </button>
    {open ? <div id={menuId} className="article-share-menu" role="menu" aria-label="Share article">
      <p>Share Evo Daily</p>
      {nativeShare ? <button type="button" role="menuitem" onClick={useNativeShare}><span className="share-mark" aria-hidden="true">↗</span>SHARE VIA DEVICE</button> : null}
      {nativeShare ? <span className="share-rule" aria-hidden="true" /> : null}
      {destinations.map(([label, href, mark]) => <a key={label} role="menuitem" href={href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}><span className="share-mark" aria-hidden="true">{mark}</span>{label}</a>)}
      <a role="menuitem" href={email}><span className="share-mark" aria-hidden="true">@</span>EMAIL</a>
      <span className="share-rule" aria-hidden="true" />
      <button type="button" role="menuitem" onClick={copyLink}><span className="share-mark" aria-hidden="true">⌁</span>{copied ? 'COPIED' : 'COPY LINK'}</button>
      <span className="article-share-status" role="status" aria-live="polite">{error}</span>
    </div> : null}
  </div>
}
