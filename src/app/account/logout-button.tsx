'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const isSigningOutRef = useRef(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [error, setError] = useState('')

  async function handleLogout() {
    if (isSigningOutRef.current) {
      return
    }

    isSigningOutRef.current = true
    setIsSigningOut(true)
    setError('')

    try {
      const supabase = createClient()
      const { error: signOutError } = await supabase.auth.signOut()

      if (signOutError) {
        setError('We could not sign you out right now. Please try again.')
        return
      }

      router.replace('/auth/login')
      router.refresh()
    } catch {
      setError('We could not sign you out right now. Please try again.')
    } finally {
      isSigningOutRef.current = false
      setIsSigningOut(false)
    }
  }

  return (
    <div className={compact ? '' : 'mt-8'}>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isSigningOut}
        className={`${compact ? 'button-secondary' : 'button-light'} inline-flex w-full items-center justify-center px-5 py-3 text-sm font-semibold`}
      >
        {isSigningOut ? 'Signing out…' : 'Log out'}
      </button>
      {error ? <p role="alert" className="mt-3 border-l border-rose-400 pl-3 text-sm leading-6 text-rose-300">{error}</p> : null}
    </div>
  )
}
