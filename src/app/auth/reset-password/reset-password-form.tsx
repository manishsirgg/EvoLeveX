'use client'

import Link from 'next/link'
import { FormEvent, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

const minimumPasswordLength = 8

type FieldErrors = Partial<Record<'password' | 'confirmPassword', string>>

export function ResetPasswordForm() {
  const isSubmittingRef = useRef(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmittingRef.current) return

    const nextErrors: FieldErrors = {}
    if (password.length < minimumPasswordLength) nextErrors.password = `Use at least ${minimumPasswordLength} characters.`
    if (confirmPassword !== password) nextErrors.confirmPassword = 'Passwords do not match.'
    setErrors(nextErrors)
    setFormError('')
    if (Object.keys(nextErrors).length > 0) return

    isSubmittingRef.current = true
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setFormError('We could not update your password. The recovery session may have expired; request a new reset link and try again.')
        return
      }

      await supabase.auth.signOut()
      setPassword('')
      setConfirmPassword('')
      setIsComplete(true)
    } catch {
      setFormError('We could not update your password right now. Please check your connection and try again.')
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  if (isComplete) {
    return (
      <main className="flex flex-1 items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
        <section aria-labelledby="password-updated-title" className="w-full max-w-md border border-white/10 bg-zinc-900/70 p-8 shadow-2xl shadow-black/30 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">EvoLeveX</p>
          <div className="mt-8 border-l border-amber-400 pl-5">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-300">Password updated</p>
            <h1 id="password-updated-title" className="mt-3 text-3xl font-semibold tracking-tight text-white">Your password has been changed successfully.</h1>
            <p role="status" aria-live="polite" className="mt-4 text-base leading-7 text-zinc-400">Your EvoLeveX account is ready. Sign in securely with your new password.</p>
          </div>
          <Link href="/auth/login" className="button-light mt-8 inline-flex w-full items-center justify-center px-5 py-3 text-sm">Sign in with your new password</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-950 px-6 py-12 text-zinc-100 sm:py-16">
      <section aria-labelledby="reset-password-title" className="w-full max-w-md border border-white/10 bg-zinc-900/70 p-8 shadow-2xl shadow-black/30 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">EvoLeveX</p>
        <p className="mt-3 text-sm font-medium tracking-wide text-amber-300">Secure your account</p>
        <h1 id="reset-password-title" className="mt-8 text-3xl font-semibold tracking-tight text-white">Choose a new password</h1>
        <p className="mt-3 text-base leading-7 text-zinc-400">Create a new password for your EvoLeveX account.</p>

        <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-200">New password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined })); setFormError('') }} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-requirement password-error' : 'password-requirement'} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-white outline-none transition-colors focus:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/50" />
            <p id="password-requirement" className="mt-2 text-sm text-zinc-500">Use at least {minimumPasswordLength} characters.</p>
            {errors.password ? <p id="password-error" className="mt-2 text-sm text-rose-300">{errors.password}</p> : null}
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-zinc-200">Confirm new password</label>
            <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setErrors((current) => ({ ...current, confirmPassword: undefined })); setFormError('') }} aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-white outline-none transition-colors focus:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/50" />
            {errors.confirmPassword ? <p id="confirm-password-error" className="mt-2 text-sm text-rose-300">{errors.confirmPassword}</p> : null}
          </div>

          {formError ? <p role="alert" className="border-l border-rose-400 pl-3 text-sm leading-6 text-rose-300">{formError}</p> : null}
          <button type="submit" disabled={isSubmitting} className="button-primary inline-flex w-full items-center justify-center px-5 py-3 text-sm">{isSubmitting ? 'Updating password…' : 'Update password'}</button>
        </form>
      </section>
    </main>
  )
}
