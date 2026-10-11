'use client'

import { useState, useTransition } from 'react'
import { inspectPrintfulMockupRecovery, uploadMidnightNavyPrintfulMockup, uploadCoolBluePrintfulMockup } from './actions'

const PRODUCT_ID = 479728769
type Color = 'navy' | 'blue'
const choices = {
  navy: { label: 'Midnight Navy', fileId: 1082848721 },
  blue: { label: 'Cool Blue', fileId: 1082848722 },
} as const

function IndividualUploadControl({ color, authorized, otherAuthorized }:
  { color: Color; authorized: boolean; otherAuthorized: boolean }) {
  const choice = choices[color]
  const [pending, startTransition] = useTransition()
  const [confirmed, setConfirmed] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<string | null>(null)
  const safeToStart = authorized && !otherAuthorized && confirmed && !pending && !attempted && recovery === 'NOT_RESERVED'

  const inspect = () => startTransition(async () => {
    setRecovery(null)
    try {
      const outcome = await inspectPrintfulMockupRecovery(PRODUCT_ID,choice.fileId)
      setRecovery('error' in outcome ? outcome.error : outcome.status.recovery_state)
    } catch { setRecovery('RECOVERY_INSPECTION_FAILED') }
  })

  const upload = () => {
    if (!safeToStart) return
    if (!window.confirm(`Authorize ONE ${choice.label} mockup transfer (file ${choice.fileId})? Never retry on an uncertain result.`)) return
    setAttempted(true)
    setStatus(null)
    startTransition(async () => {
      try {
        const outcome = color === 'navy'
          ? await uploadMidnightNavyPrintfulMockup()
          : await uploadCoolBluePrintfulMockup()
        setStatus(outcome.ok ? 'VERIFIED_COMPLETE' : outcome.code)
      } catch { setStatus('RECONCILIATION_REQUIRED') }
    })
  }

  return <section className="border border-amber-300/30 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">{choice.label} — controlled mockup transfer</h2>
    <p className="mt-2 text-sm text-zinc-400">Approved Printful file {choice.fileId}. No changes to published status, stock or variants.</p>
    <p role="status" className="mt-2 text-sm text-amber-200">
      {!authorized ? 'Transfer locked: individual authorization is OFF.' :
       otherAuthorized ? 'Transfer locked: more than one color is authorized. Disable the other color first.' :
       'Individual authorization configured; inspect current recovery state before upload.'}
    </p>
    <button type="button" className="button-secondary mt-4 px-4 py-3 text-sm" disabled={pending} onClick={inspect}>
      {pending ? 'Inspecting…' : 'Inspect recovery status (read-only)'}
    </button>
    {recovery && <p role="status" className="mt-2 text-sm">Recovery state: {recovery}</p>}
    {authorized && !otherAuthorized && !attempted && recovery === 'NOT_RESERVED' && <div className="mt-4 space-y-3">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
        <span>I have verified the production prerequisites and will make exactly one attempt. Any uncertain outcome requires manual reconciliation.</span>
      </label>
      <button type="button" className="button-primary px-4 py-3 text-sm" disabled={!safeToStart} onClick={upload}>
        Attempt one {choice.label} mockup transfer
      </button>
    </div>}
    {status && <p role="status" className="mt-3 text-sm text-amber-200">
      Upload result: {status}. {status === 'VERIFIED_COMPLETE' ? 'Disable flags, redeploy and independently verify database/Storage.' : 'Do not retry. Inspect recovery and reconcile manually.'}
    </p>}
    {attempted && <p className="mt-2 text-xs text-zinc-400">This page session cannot repeat the transfer. Database claim ownership persists.</p>}
  </section>
}

export function NavyBlueUploadControls({ navyAuthorized, blueAuthorized }:
  { navyAuthorized: boolean; blueAuthorized: boolean }) {
  return <div className="mt-8 grid gap-5">
    <IndividualUploadControl color="navy" authorized={navyAuthorized} otherAuthorized={blueAuthorized} />
    <IndividualUploadControl color="blue" authorized={blueAuthorized} otherAuthorized={navyAuthorized} />
  </div>
}
