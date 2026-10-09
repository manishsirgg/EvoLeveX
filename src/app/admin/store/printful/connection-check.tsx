'use client'

import { useState, useTransition } from 'react'
import { checkPrintfulConnection, previewPrintfulProduct } from './actions'

type Product = { id: number; name: string; variants: number }
type Probe = { connected: boolean; productCount: number; products: Product[]; error?: string }

export function ConnectionCheck() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<Probe | null>(null)
  const [detail, setDetail] = useState<{ id: number; name: string; variants: { syncId: number; catalogId: number | null; name: string; sku: string | null; retailPrice: string | null; synced: boolean }[] } | null>(null)
  const [detailError, setDetailError] = useState(false)
  return <section className="mt-8 border border-white/10 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Read-only connectivity</h2>
    <p className="mt-2 text-sm text-zinc-400">Checks configured Printful products only. No imports, database writes, or fulfillment orders.</p>
    <button type="button" disabled={pending} className="button-primary mt-5 px-4 py-3 text-sm" onClick={() => startTransition(async () => {
      setResult(null)
      setDetail(null)
      setDetailError(false)
      try { setResult(await checkPrintfulConnection()) }
      catch { setResult({ connected: false, productCount: 0, products: [], error: 'CHECK_FAILED' }) }
    })}>{pending ? 'Checking…' : 'Check Printful connection'}</button>
    {result ? <div className="mt-5" role="status">
      <p className={result.connected ? 'text-emerald-300' : 'text-amber-200'}>{result.connected ? 'Connection authenticated' : 'Connection could not be verified'}</p>
      {!result.connected ? <p className="mt-2 text-sm text-zinc-400">{result.error === 'TOKEN_NOT_CONFIGURED' ? 'Printful token not configured in this environment.' : 'Review credentials and Printful availability. No changes were made.'}</p> : <>
        <p className="mt-2 text-sm text-zinc-400">Showing {result.productCount} configured products (maximum 10).</p>
        <ul className="mt-3 space-y-2">{result.products.map(product => <li key={product.id} className="border border-white/10 p-3 text-sm">{product.name} · {product.variants} variants <button type="button" disabled={pending} className="ml-3 text-amber-300 underline" onClick={() => startTransition(async () => { setDetail(null); setDetailError(false); try { const preview = await previewPrintfulProduct(product.id); if ('error' in preview) setDetailError(true); else setDetail(preview) } catch { setDetailError(true) } })}>Preview variants</button></li>)}</ul>
      </>}
      {detailError ? <p className="mt-4 text-amber-200">Could not retrieve product variants.</p> : null}
      {detail ? <section className="mt-5 border border-white/10 p-4"><h3 className="font-semibold">{detail.name} — {detail.variants.length} variants</h3><p className="mt-2 text-sm text-zinc-400">Preview only. No items have been imported.</p><ul className="mt-3 max-h-80 space-y-2 overflow-auto">{detail.variants.map(v => <li key={v.syncId} className="border-b border-white/10 p-2 text-sm">{v.name} · {v.sku ?? 'No SKU'} · {v.synced ? 'Synced' : 'Not synced'}</li>)}</ul></section> : null}
    </div> : null}
  </section>
}
