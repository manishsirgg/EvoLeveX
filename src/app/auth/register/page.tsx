'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

const minimumPasswordLength = 8
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldName = 'fullName' | 'email' | 'password' | 'confirmPassword'
type FieldErrors = Partial<Record<FieldName, string>>

function getSignupErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase()

  if (
    normalizedMessage.includes('already registered') ||
    normalizedMessage.includes('already exists') ||
    normalizedMessage.includes('user already')
  ) {
    return 'An account with this email may already exist. Try signing in or use a different email address.'
  }

  if (normalizedMessage.includes('password')) {
    return `Choose a password with at least ${minimumPasswordLength} characters.`
  }

  if (normalizedMessage.includes('email')) {
    return 'Enter a valid email address and try again.'
  }

  return 'We could not create your account right now. Please check your connection and try again.'
}

function getResendErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('rate limit') || normalizedMessage.includes('too many')) {
    return 'Please wait a moment before requesting another confirmation email.'
  }

  return 'We could not resend the confirmation email right now. Please try again shortly.'
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [resendStatus, setResendStatus] = useState('')

  function clearFieldError(field: FieldName) {
    setErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors
      }

      const nextErrors = { ...currentErrors }
      delete nextErrors[field]
      return nextErrors
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedFullName = fullName.trim()
    const trimmedEmail = email.trim()
    const nextErrors: FieldErrors = {}

    if (!trimmedFullName) {
      nextErrors.fullName = 'Enter your full name.'
    }

    if (!emailPattern.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    if (password.length < minimumPasswordLength) {
      nextErrors.password = `Use at least ${minimumPasswordLength} characters.`
    }

    if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    setErrors(nextErrors)
    setFormError('')

    if (Object.keys(nextErrors).length > 0 || isSubmitting) {
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedFullName,
            display_name: trimmedFullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      })

      if (error) {
        setFormError(getSignupErrorMessage(error.message))
        return
      }

      setConfirmationEmail(trimmedEmail)
    } catch {
      setFormError('We could not create your account right now. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResend() {
    setIsResending(true)
    setResendStatus('')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: confirmationEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      })

      if (error) {
        setResendStatus(getResendErrorMessage(error.message))
        return
      }

      setResendStatus('A new confirmation email has been sent. Check your inbox.')
    } catch {
      setResendStatus('We could not resend the confirmation email right now. Please try again shortly.')
    } finally {
      setIsResending(false)
    }
  }

  if (confirmationEmail) {
    return (
      <main className="flex flex-1 items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
        <section
          aria-labelledby="confirmation-title"
          className="w-full max-w-md border border-white/10 bg-zinc-900/70 p-8 shadow-2xl shadow-black/30 sm:p-10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">EvoLeveX</p>
          <div className="mt-8 border-l border-amber-400 pl-5">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-300">One last step</p>
            <h1 id="confirmation-title" className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Confirm your email
            </h1>
            <p className="mt-4 text-base leading-7 text-zinc-400">
              We sent a confirmation link to <span className="font-medium text-zinc-200">{confirmationEmail}</span>.
              Check your inbox and click the link to activate your EvoLeveX account.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="button-secondary inline-flex w-full items-center justify-center px-5 py-3 text-sm font-semibold"
            >
              {isResending ? 'Sending confirmation email…' : 'Resend confirmation email'}
            </button>
            {resendStatus ? (
              <p role="status" aria-live="polite" className="text-sm leading-6 text-zinc-400">
                {resendStatus}
              </p>
            ) : null}
            <Link
              href="/auth/login"
              className="button-light inline-flex w-full items-center justify-center px-5 py-3 text-sm"
            >
              Return to sign in
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-950 px-6 py-12 text-zinc-100 sm:py-16">
      <section aria-labelledby="register-title" className="w-full max-w-md border border-white/10 bg-zinc-900/70 p-8 shadow-2xl shadow-black/30 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">EvoLeveX</p>
        <p className="mt-3 text-sm font-medium tracking-wide text-amber-300">Evolve. Elevate. Excel.</p>
        <h1 id="register-title" className="mt-8 text-3xl font-semibold tracking-tight text-white">Create your account</h1>
        <p className="mt-3 text-base leading-7 text-zinc-400">Join EvoLeveX and begin your next level.</p>

        <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
          <div>
            <label htmlFor="full-name" className="block text-sm font-medium text-zinc-200">Full name</label>
            <input id="full-name" name="fullName" type="text" autoComplete="name" value={fullName} onChange={(event) => { setFullName(event.target.value); clearFieldError('fullName') }} aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? 'full-name-error' : undefined} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/50" />
            {errors.fullName ? <p id="full-name-error" className="mt-2 text-sm text-rose-300">{errors.fullName}</p> : null}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-200">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => { setEmail(event.target.value); clearFieldError('email') }} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/50" />
            {errors.email ? <p id="email-error" className="mt-2 text-sm text-rose-300">{errors.email}</p> : null}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-200">Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); clearFieldError('password') }} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-requirement password-error' : 'password-requirement'} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/50" />
            <p id="password-requirement" className="mt-2 text-sm text-zinc-500">Use at least {minimumPasswordLength} characters.</p>
            {errors.password ? <p id="password-error" className="mt-2 text-sm text-rose-300">{errors.password}</p> : null}
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-zinc-200">Confirm password</label>
            <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); clearFieldError('confirmPassword') }} aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/50" />
            {errors.confirmPassword ? <p id="confirm-password-error" className="mt-2 text-sm text-rose-300">{errors.confirmPassword}</p> : null}
          </div>

          {formError ? <p role="alert" className="border-l border-rose-400 pl-3 text-sm leading-6 text-rose-300">{formError}</p> : null}

          <button type="submit" disabled={isSubmitting} className="button-primary inline-flex w-full items-center justify-center px-5 py-3 text-sm">
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-zinc-400">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-semibold text-white underline decoration-amber-300 underline-offset-4 transition-colors hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  )
}
