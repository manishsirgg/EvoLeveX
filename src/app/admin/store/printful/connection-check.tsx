'use client'

import { useState, useTransition } from 'react'
import { checkPrintfulConnection, previewPrintfulProduct, importPrintfulDraft, checkPrintfulImportReadiness, inspectPrintfulMedia } from './actions'

type Product = { id: number; name: string; variants: number }
type Probe = { connected: boolean; productCount: number; products: Product[]; error?: string }

export function ConnectionCheck({ importEnabled }: { importEnabled: boolean }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<Probe | null>(null)
  const [detail, setDetail] = useState<{ id: number; name: string; variants: { syncId: number; catalogId: number | null; name: string; sku: string | null; retailPrice: string | null; synced: boolean }[] } | null>(null)
  const [detailError, setDetailError] = useState(false)
  const [media, setMedia] = useState<{ candidates: { syncVariantId: number; fileId: number; type: string; previewUrl: string }[]; inspectedVariants: number } | null>(null)
  const [mediaStatus, setMediaStatus] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<{ ready: boolean; variantCount: number; code: string } | null>(null)
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
        <ul className="mt-3 space-y-2">{result.products.map(product => <li key={product.id} className="border border-white/10 p-3 text-sm">{product.name} · {product.variants} variants <button type="button" disabled={pending} className="ml-3 text-amber-300 underline" onClick={() => startTransition(async () => { setDetail(null); setDetailError(false); setReadiness(null); setMedia(null); setMediaStatus(null); try { const preview = await previewPrintfulProduct(product.id); if ('error' in preview) setDetailError(true); else setDetail(preview) } catch { setDetailError(true) } })}>Preview variants</button></li>)}</ul>
      </>}
      {detailError ? <p className="mt-4 text-amber-200">Could not retrieve product variants.</p> : null}
      {detail ? <div className="mt-4"><button type="button" disabled={pending} className="button-secondary px-4 py-3 text-sm font-semibold" onClick={() => startTransition(async () => { setReadiness(null); try { setReadiness(await checkPrintfulImportReadiness(detail.id)) } catch { setReadiness({ ready: false, variantCount: 0, code: 'PREFLIGHT_FAILED' }) } })}>Check import readiness (no changes)</button>{readiness ? <p role="status" className={readiness.ready ? 'mt-2 text-emerald-300' : 'mt-2 text-amber-200'}>{readiness.ready ? `${readiness.variantCount} variants validated. This is not a store-ownership or duplicate-import guarantee.` : `Not ready: ${readiness.code}`}</p> : null}</div> : null}
      {detail && importEnabled && readiness?.ready ? <div className="mt-4"><button type="button" className="bg-amber-300 px-4 py-3 font-semibold text-black disabled:opacity-50" disabled={pending} onClick={() => { if (!window.confirm('Import this Printful product as an unpublished draft?')) return; startTransition(async () => { const outcome = await importPrintfulDraft(detail.id); setImportResult(outcome.productId ? 'Draft created successfully.' : 'Import failed; no product has been published.') }) }}>Import as Draft</button>{importResult ? <p role="status" className="mt-2 text-sm">{importResult}</p> : null}</div> : null}
      {detail ? <section className="mt-5 border border-white/10 p-4">
        <h3 className="font-semibold">Printful media inspection</h3>
        <p className="mt-2 text-sm text-zinc-400">Read-only inspection of Printful file previews. These may be artwork previews rather than production mockups. No files are downloaded or stored.</p>
        <button type="button" disabled={pending} className="button-secondary mt-3 px-4 py-3 text-sm" onClick={() => startTransition(async () => {
          setMedia(null); setMediaStatus(null)
          try {
            const response = await inspectPrintfulMedia(detail.id)
            if ('error' in response) setMediaStatus(response.error)
            else setMedia(response)
          } catch { setMediaStatus('MEDIA_INSPECTION_FAILED') }
        })}>Inspect Printful media (no changes)</button>
        {mediaStatus ? <p className="mt-3 text-sm text-amber-200" role="status">Media inspection unavailable: {mediaStatus}</p> : null}
        {media ? <div className="mt-3" role="status"><p className="text-sm text-zinc-300">Inspected {media.inspectedVariants} variants; found {media.candidates.length} distinct approved file previews.</p>
          <ul className="mt-3 max-h-64 space-y-2 overflow-auto">{media.candidates.map(item => <li key={item.fileId + ':' + item.syncVariantId} className="border-b border-white/10 p-2 text-xs">File {item.fileId} · {item.type} · Variant {item.syncVariantId} · <a className="text-amber-300 underline" href={item.previewUrl} target="_blank" rel="noopener noreferrer">View provider preview</a></li>)}</ul>
          <p className="mt-2 text-xs text-zinc-400">Review suitability and licensing before any future ingestion. This view does not establish a product image or gallery.</p>
        </div> : null}
      </section> : null}
      {detail ? <section className="mt-5 border border-white/10 p-4"><h3 className="font-semibold">{detail.name} — {detail.variants.length} variants</h3><p className="mt-2 text-sm text-zinc-400">Preview only. No items have been imported.</p><ul className="mt-3 max-h-80 space-y-2 overflow-auto">{detail.variants.map(v => <li key={v.syncId} className="border-b border-white/10 p-2 text-sm">{v.name} · {v.sku ?? 'No SKU'} · {v.synced ? 'Synced' : 'Not synced'}</li>)}</ul></section> : null}
    </div> : null}
  </section>
}
