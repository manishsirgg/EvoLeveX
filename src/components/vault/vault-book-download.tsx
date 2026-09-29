'use client'

import { useState } from 'react'

type VaultBookDownloadProps = {
  assetId: string | null
  legacyProductId?: string
  title: string
  label?: string
}

export function VaultBookDownload({ assetId, legacyProductId, title, label = 'Download PDF' }: VaultBookDownloadProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  async function download() {
    if (state === 'loading') return
    setState('loading')
    try {
      const response = await fetch('/api/vault/books/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assetId ? { assetId } : { productId: legacyProductId }),
      })
      const body: unknown = await response.json().catch(() => null)
      const url = body && typeof body === 'object' && 'url' in body && typeof body.url === 'string'
        ? body.url : null
      if (!response.ok || !url) throw new Error('Download unavailable')
      window.location.assign(url)
      setState('idle')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={download} disabled={state === 'loading'}
        className="button-light inline-flex w-full items-center justify-center px-5 py-3 text-sm">
        {state === 'loading' ? 'Preparing secure download…' : state === 'error' ? 'Try download again' : label}
      </button>
      {state === 'error' ? (
        <p role="alert" className="text-xs leading-5 text-rose-300">
          We could not prepare {title}. Please try again.
        </p>
      ) : null}
    </div>
  )
}
