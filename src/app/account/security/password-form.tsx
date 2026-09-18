'use client'

import { FormEvent, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

const minimumPasswordLength = 8

export function PasswordForm() {
  const submittingRef = useRef(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmationError, setConfirmationError] = useState('')
  const [formError, setFormError] = useState('')
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return
    const nextPasswordError = password.length < minimumPasswordLength ? `Use at least ${minimumPasswordLength} characters.` : ''
    const nextConfirmationError = password !== confirmation ? 'Passwords do not match.' : ''
    setPasswordError(nextPasswordError)
    setConfirmationError(nextConfirmationError)
    setFormError('')
    setStatus('')
    if (nextPasswordError || nextConfirmationError) return

    submittingRef.current = true
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        setFormError('Your session has expired. Sign in again before changing your password.')
        return
      }

      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        const requiresReauthentication = /reauth|nonce|recent|session/i.test(error.message)
        setFormError(requiresReauthentication
          ? 'For your protection, Supabase requires a fresh sign-in before this password can be changed. Sign out, sign in again, and retry.'
          : 'We could not update your password. Make sure it meets the account password requirements and try again.')
        return
      }

      setPassword('')
      setConfirmation('')
      setStatus('Password updated successfully.')
    } catch {
      setFormError('We could not update your password. Check your connection and try again.')
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="password-heading" className="border border-white/10 bg-zinc-900/50 p-6 sm:p-8">
      <h2 id="password-heading" className="text-lg font-semibold text-white">Change password</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">Use at least eight characters and choose a password you do not use elsewhere.</p>
      <form noValidate onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-5">
        <div><label htmlFor="new-password" className="text-sm font-medium text-zinc-200">New password</label><input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setPasswordError(''); setFormError('') }} aria-invalid={Boolean(passwordError)} aria-describedby="password-guidance password-change-error" className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30" /><p id="password-guidance" className="mt-2 text-sm text-zinc-500">Minimum 8 characters.</p>{passwordError ? <p id="password-change-error" className="mt-2 text-sm text-rose-300">{passwordError}</p> : null}</div>
        <div><label htmlFor="confirm-new-password" className="text-sm font-medium text-zinc-200">Confirm new password</label><input id="confirm-new-password" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setConfirmationError(''); setFormError('') }} aria-invalid={Boolean(confirmationError)} aria-describedby={confirmationError ? 'confirmation-error' : undefined} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30" />{confirmationError ? <p id="confirmation-error" className="mt-2 text-sm text-rose-300">{confirmationError}</p> : null}</div>
        <div aria-live="polite">{status ? <p role="status" className="border-l-2 border-emerald-400 pl-3 text-sm text-emerald-300">{status}</p> : null}{formError ? <p role="alert" className="border-l-2 border-rose-400 pl-3 text-sm leading-6 text-rose-300">{formError}</p> : null}</div>
        <button type="submit" disabled={isSubmitting} className="bg-white px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-50">{isSubmitting ? 'Updating…' : 'Update password'}</button>
      </form>
    </section>
  )
}
