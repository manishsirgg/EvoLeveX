'use client'

import Link from 'next/link'
import { FormEvent, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPasswordPage() {
  const isSubmittingRef = useRef(false)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmittingRef.current) return

    const trimmedEmail = email.trim()
    setEmailError('')
    setFormError('')

    if (!emailPattern.test(trimmedEmail)) {
      setEmailError('Enter a valid email address.')
      return
    }

    isSubmittingRef.current = true
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth/recovery`,
      })

      if (error) {
        setFormError('We could not send reset instructions right now. Please wait a moment and try again.')
        return
      }

      setIsComplete(true)
    } catch {
      setFormError('We could not send reset instructions right now. Please check your connection and try again.')
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  if (isComplete) {
    return (
      <main className="flex flex-1 items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
        <section aria-labelledby="forgot-password-success-title" className="w-full max-w-md border border-white/10 bg-zinc-900/70 p-8 shadow-2xl shadow-black/30 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">EvoLeveX</p>
          <div className="mt-8 border-l border-amber-400 pl-5">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-300">Check your email</p>
            <h1 id="forgot-password-success-title" className="mt-3 text-3xl font-semibold tracking-tight text-white">Reset instructions requested</h1>
            <p role="status" aria-live="polite" className="mt-4 text-base leading-7 text-zinc-400">
              If an EvoLeveX account exists for this email address, we&apos;ve sent password reset instructions.
            </p>
          </div>
          <Link href="/auth/login" className="button-light mt-8 inline-flex w-full items-center justify-center px-5 py-3 text-sm">
            Return to sign in
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-950 px-6 py-12 text-zinc-100 sm:py-16">
      <section aria-labelledby="forgot-password-title" className="w-full max-w-md border border-white/10 bg-zinc-900/70 p-8 shadow-2xl shadow-black/30 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">EvoLeveX</p>
        <p className="mt-3 text-sm font-medium tracking-wide text-amber-300">Account recovery</p>
        <h1 id="forgot-password-title" className="mt-8 text-3xl font-semibold tracking-tight text-white">Reset your password</h1>
        <p className="mt-3 text-base leading-7 text-zinc-400">Enter your email address and we&apos;ll send reset instructions if an account exists.</p>

        <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-200">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => { setEmail(event.target.value); setEmailError(''); setFormError('') }} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? 'email-error' : undefined} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-white outline-none transition-colors focus:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/50" />
            {emailError ? <p id="email-error" className="mt-2 text-sm text-rose-300">{emailError}</p> : null}
          </div>

          {formError ? <p role="alert" className="border-l border-rose-400 pl-3 text-sm leading-6 text-rose-300">{formError}</p> : null}

          <button type="submit" disabled={isSubmitting} className="button-primary inline-flex w-full items-center justify-center px-5 py-3 text-sm">
            {isSubmitting ? 'Sending instructions…' : 'Send reset instructions'}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-zinc-400">
          Remember your password?{' '}
          <Link href="/auth/login" className="font-semibold text-white underline decoration-amber-300 underline-offset-4 transition-colors hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Sign in</Link>
        </p>
      </section>
    </main>
  )
}
