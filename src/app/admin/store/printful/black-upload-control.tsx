'use client'

import { useState, useTransition } from 'react'
import { inspectPrintfulMockupRecovery, uploadFirstBlackPrintfulMockup } from './actions'

const PRODUCT_ID = 479728769
const FILE_ID = 1082848720

export function BlackUploadControl({ authorized }: { authorized: boolean }) {
  const [pending, startTransition] = useTransition()
  const [confirmed, setConfirmed] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<string | null>(null)

  const inspect = () => startTransition(async () => {
    try {
      const outcome = await inspectPrintfulMockupRecovery(PRODUCT_ID,FILE_ID)
      if ('error' in outcome) setRecovery(outcome.error)
      else setRecovery(outcome.status.recovery_state)
    } catch { setRecovery('RECOVERY_INSPECTION_FAILED') }
  })

  const upload = () => {
    if (!authorized || !confirmed || pending || attempted) return
    if (!window.confirm('Authorize exactly ONE Black Printful mockup upload? Do not retry an ambiguous result.')) return
    setAttempted(true)
    setResult(null)
    startTransition(async () => {
      try {
        const outcome = await uploadFirstBlackPrintfulMockup()
        setResult(outcome.ok ? 'VERIFIED_COMPLETE' : outcome.code)
      } catch { setResult('RECONCILIATION_REQUIRED') }
    })
  }

  return <section className="mt-8 border border-amber-300/30 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">First Black mockup — controlled transfer</h2>
    <p className="mt-2 text-sm text-zinc-400">Printful file {FILE_ID}. This control cannot upload Navy, Blue, or arbitrary files. It does not publish the product or activate variants.</p>
    <p className="mt-2 text-sm text-amber-200" role="status">
      {authorized ? 'Server-side first-upload authorization configured. General media upload must also be explicitly enabled.' : 'Transfer locked: independent authorization is OFF. No upload can be started here.'}
    </p>
    <button type="button" className="button-secondary mt-4 px-4 py-3 text-sm" disabled={pending} onClick={inspect}>
      {pending ? 'Checking…' : 'Inspect recovery status (read-only)'}
    </button>
    {recovery && <p className="mt-2 text-sm" role="status">Recovery state: {recovery}</p>}
    {authorized && !attempted && <div className="mt-4 space-y-3">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
        <span>I have checked the production prerequisites and understand that an uncertain result must not be retried automatically.</span>
      </label>
      <button type="button" className="button-primary px-4 py-3 text-sm" disabled={!confirmed || pending} onClick={upload}>
        Attempt one Black mockup transfer
      </button>
    </div>}
    {result && <p className="mt-3 text-sm text-amber-200" role="status">
      Upload result: {result}. {result === 'VERIFIED_COMPLETE' ? 'Recheck database and Storage records.' : 'Do not retry; inspect recovery state and reconcile manually.'}
    </p>}
    {attempted && <p className="mt-2 text-xs text-zinc-400">This page session will not offer another attempt. Server-side claim ownership must be reviewed before any later attempt.</p>}
  </section>
}
