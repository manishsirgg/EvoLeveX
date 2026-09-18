'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldName = 'email' | 'password'
type FieldErrors = Partial<Record<FieldName, string>>

function getSignInErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase()

  if (
    normalizedMessage.includes('email not confirmed') ||
    normalizedMessage.includes('email not verified') ||
    normalizedMessage.includes('unconfirmed')
  ) {
    return 'Please confirm your email address before signing in.'
  }

  if (
    normalizedMessage.includes('invalid login credentials') ||
    normalizedMessage.includes('invalid credentials')
  ) {
    return 'Email or password is incorrect.'
  }

  if (
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('fetch') ||
    normalizedMessage.includes('connection')
  ) {
    return "We couldn't connect right now. Please check your connection and try again."
  }

  return 'We could not sign you in right now. Please try again.'
}

export default function LoginPage() {
  const router = useRouter()
  const isSubmittingRef = useRef(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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

    if (isSubmittingRef.current) {
      return
    }

    const trimmedEmail = email.trim()
    const nextErrors: FieldErrors = {}

    if (!trimmedEmail) {
      nextErrors.email = 'Enter your email address.'
    } else if (!emailPattern.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    if (!password) {
      nextErrors.password = 'Enter your password.'
    }

    setErrors(nextErrors)
    setFormError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    isSubmittingRef.current = true
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (error) {
        setFormError(getSignInErrorMessage(error.message))
        return
      }

      router.replace('/account')
      router.refresh()
    } catch {
      setFormError("We couldn't connect right now. Please check your connection and try again.")
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-950 px-6 py-12 text-zinc-100 sm:py-16">
      <section
        aria-labelledby="login-title"
        className="w-full max-w-md border border-white/10 bg-zinc-900/70 p-8 shadow-2xl shadow-black/30 sm:p-10"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">EvoLeveX</p>
        <p className="mt-3 text-sm font-medium tracking-wide text-amber-300">Evolve. Elevate. Excel.</p>
        <h1 id="login-title" className="mt-8 text-3xl font-semibold tracking-tight text-white">Welcome back.</h1>
        <p className="mt-3 text-base leading-7 text-zinc-400">Sign in to continue your journey.</p>

        <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-200">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                clearFieldError('email')
                setFormError('')
              }}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/50"
            />
            {errors.email ? <p id="email-error" className="mt-2 text-sm text-rose-300">{errors.email}</p> : null}
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-4">
              <label htmlFor="password" className="block text-sm font-medium text-zinc-200">Password</label>
              <Link href="/auth/forgot-password" className="text-sm font-medium text-zinc-300 underline decoration-amber-300 underline-offset-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                clearFieldError('password')
                setFormError('')
              }}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/50"
            />
            {errors.password ? <p id="password-error" className="mt-2 text-sm text-rose-300">{errors.password}</p> : null}
          </div>

          {formError ? <p role="alert" className="border-l border-rose-400 pl-3 text-sm leading-6 text-rose-300">{formError}</p> : null}

          <button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-zinc-400">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="font-semibold text-white underline decoration-amber-300 underline-offset-4 transition-colors hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            Create one
          </Link>
        </p>
      </section>
    </main>
  )
}
