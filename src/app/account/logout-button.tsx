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
        className={`inline-flex w-full items-center justify-center px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60 ${compact ? 'border border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-white' : 'border border-zinc-700 bg-white text-zinc-950 hover:bg-zinc-200'}`}
      >
        {isSigningOut ? 'Signing out…' : 'Log out'}
      </button>
      {error ? <p role="alert" className="mt-3 border-l border-rose-400 pl-3 text-sm leading-6 text-rose-300">{error}</p> : null}
    </div>
  )
}
