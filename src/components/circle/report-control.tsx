'use client'

import { FormEvent, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { CIRCLE_REPORT_DETAILS_MAX, CIRCLE_REPORT_REASONS, type CircleReportReason, type CircleReportTarget } from '@/lib/circle-reporting'

type Props = { targetType: CircleReportTarget; targetId: string; path: string; authenticated: boolean; initiallyReported: boolean }

export function CircleReportControl({ targetType, targetId, path, authenticated, initiallyReported }: Props) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [reported, setReported] = useState(initiallyReported)
  const [reason, setReason] = useState<CircleReportReason>('spam')
  const [details, setDetails] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  function open() {
    if (reported) return
    if (!authenticated) { router.push(`/auth/login?next=${encodeURIComponent(path)}`); return }
    setMessage('')
    dialogRef.current?.showModal()
  }

  function close() {
    if (!pending) dialogRef.current?.close()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = details.trim()
    if (reason === 'other' && !trimmed) { setMessage('Add details when selecting Other.'); return }
    setPending(true); setMessage('')
    try {
      const response = await fetch('/api/circle/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store',
        body: JSON.stringify({ targetType, targetId, reason, details }),
      })
      const result = await response.json() as { reported?: unknown; error?: unknown }
      if (response.status === 401) { router.push(`/auth/login?next=${encodeURIComponent(path)}`); return }
      if (!response.ok || result.reported !== true) throw new Error(typeof result.error === 'string' ? result.error : 'Could not submit report. Try again.')
      setReported(true); setMessage('Report submitted.')
      window.setTimeout(() => dialogRef.current?.close(), 650)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit report. Try again.')
    } finally { setPending(false) }
  }

  return <div className="circle-report-wrap">
    <button type="button" className="circle-report-action" onClick={open} disabled={reported} aria-label={`${reported ? 'Reported' : 'Report'} this ${targetType}`}>{reported ? 'Reported' : 'Report'}</button>
    <span className="circle-report-status" role="status" aria-live="polite">{reported ? 'You reported this.' : ''}</span>
    <dialog ref={dialogRef} className="circle-report-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { if (pending) event.preventDefault() }}>
      <form onSubmit={submit} className="circle-report-form">
        <div className="circle-report-heading"><div><p className="section-index">Evo Circle / Safety</p><h2 id={titleId}>Report {targetType}</h2></div><button type="button" className="circle-report-close" onClick={close} aria-label="Close report dialog" disabled={pending}>×</button></div>
        <p id={descriptionId} className="circle-report-description">Tell us why this content should be reviewed. Your report is private.</p>
        <fieldset><legend>Reason</legend><div className="circle-report-reasons">{CIRCLE_REPORT_REASONS.map((option) => <label key={option.value}><input type="radio" name={`report-reason-${targetId}`} value={option.value} checked={reason === option.value} onChange={() => setReason(option.value)} /> <span>{option.label}</span></label>)}</div></fieldset>
        <label className="circle-report-details"><span>Details {reason === 'other' ? '(required)' : '(optional)'}</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={CIRCLE_REPORT_DETAILS_MAX} rows={5} required={reason === 'other'} aria-describedby={`${descriptionId}-count`} /></label>
        <p id={`${descriptionId}-count`} className="circle-report-count">{details.length.toLocaleString('en')} / {CIRCLE_REPORT_DETAILS_MAX.toLocaleString('en')} characters</p>
        <div className="circle-report-feedback" role="status" aria-live="polite">{message}</div>
        <div className="circle-report-buttons"><button type="button" className="circle-text-button" onClick={close} disabled={pending}>Cancel</button><button type="submit" className="button button-primary" disabled={pending || reported}>{pending ? 'Submitting…' : 'Submit report'}</button></div>
      </form>
    </dialog>
  </div>
}
