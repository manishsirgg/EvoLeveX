'use client'

import { useState, useTransition } from 'react'
import { finalizePrintfulGalleryPrimary, inspectPrintfulGallery, type PrintfulGalleryRow } from './actions'

export function GalleryFinalizationControl({ authorized }: { authorized: boolean }) {
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState<PrintfulGalleryRow[] | null>(null)
  const [inspectionError, setInspectionError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const ready = rows?.length === 3 &&
    rows.every((row,index) => row.sort_order === index && row.image_active === true) &&
    rows.filter(row => row.is_primary).length === 0

  const inspect = () => startTransition(async () => {
    setRows(null)
    setConfirmed(false)
    setInspectionError(null)
    try {
      const result = await inspectPrintfulGallery()
      if ('error' in result) setInspectionError(result.error)
      else setRows(result.rows)
    } catch { setInspectionError('GALLERY_INSPECTION_UNAVAILABLE') }
  })

  const submit = () => {
    if (!authorized || !ready || !confirmed || pending || attempted) return
    if (!window.confirm('Assign the verified Black mockup as the ONLY primary image? This will not publish the T-shirt.')) return
    setAttempted(true)
    setResult(null)
    startTransition(async () => {
      try {
        const outcome = await finalizePrintfulGalleryPrimary()
        setResult(outcome.ok ? 'PRIMARY_ASSIGNMENT_REPORTED_SUCCESS' : outcome.code)
      } catch { setResult('GALLERY_FINALIZATION_REQUIRES_REVIEW') }
    })
  }

  return <section className="mt-8 border border-amber-300/30 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Printful gallery — primary image assignment</h2>
    <p className="mt-2 text-sm text-zinc-400">Target: Black (order 0); Navy and Cool Blue remain secondary. No product publishing or variant activation.</p>
    <p className="mt-2 text-sm text-amber-200" role="status">
      {authorized ? 'Finalization authorized for this deployment. Verify gallery metadata before proceeding.' :
        'Finalization locked: independent authorization is OFF.'}
    </p>
    <button type="button" className="button-secondary mt-4 px-4 py-3 text-sm" disabled={pending} onClick={inspect}>
      {pending ? 'Checking…' : 'Inspect gallery metadata (read-only)'}
    </button>
    {inspectionError && <p role="status" className="mt-2 text-sm">{inspectionError}</p>}
    {rows && <div className="mt-3 text-sm" role="status">
      {rows.map((row,index) => <p key={index}>
        Order {row.sort_order}: active={String(row.image_active)}, primary={String(row.is_primary)}
      </p>)}
    </div>}
    {authorized && ready && !attempted && <div className="mt-4 space-y-3">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
        <span>I confirmed the product remains unpublished, 18 variants inactive, and the three approved PNGs verified. I authorize one primary-image assignment.</span>
      </label>
      <button type="button" className="button-primary px-4 py-3 text-sm" disabled={!confirmed || pending} onClick={submit}>
        Assign Black as primary once
      </button>
    </div>}
    {result && <p className="mt-3 text-sm text-amber-200" role="status">
      Result: {result}. Do not retry. Disable authorization and independently verify the database state.
    </p>}
    {attempted && <p className="mt-2 text-xs text-zinc-400">No second attempt from this page session; inspect records before any further action.</p>}
  </section>
}
