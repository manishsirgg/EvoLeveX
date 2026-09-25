'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

const PRODUCT_ID = '1c50700d-8b48-452b-b9f6-54b6fa7436e4'
const PRODUCT_NAME = 'Aligned: Navigate Your Path to Purpose, Passion, and Prosperity'

type RpcCall = {
  call: number
  data: unknown
  error: unknown
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack }
  }

  return error
}

export default function TestVaultOrderPage() {
  const [supabase] = useState(createClient)
  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isCalling, setIsCalling] = useState(false)
  const [calls, setCalls] = useState<RpcCall[]>([])

  useEffect(() => {
    let active = true

    void supabase.auth.getUser()
      .then(({ data, error }) => {
        if (!active) return

        setUserId(data.user?.id ?? null)
        setAuthError(error?.message ?? null)
      })
      .catch((error: unknown) => {
        if (!active) return

        setAuthError(error instanceof Error ? error.message : 'Authentication could not be verified.')
      })
      .finally(() => {
        if (active) setAuthChecked(true)
      })

    return () => {
      active = false
    }
  }, [supabase])

  async function createPendingOrder() {
    if (!userId || isCalling) return

    setIsCalling(true)

    try {
      const { data, error } = await supabase.rpc('create_pending_evo_vault_order', {
        p_vault_product_id: PRODUCT_ID,
      })

      setCalls((current) => [
        ...current,
        { call: current.length + 1, data, error },
      ])
    } catch (error) {
      setCalls((current) => [
        ...current,
        { call: current.length + 1, data: null, error: serializeError(error) },
      ])
    } finally {
      setIsCalling(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-3xl border border-white/10 bg-zinc-900 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Temporary development test</p>
        <h1 className="mt-3 text-3xl font-semibold">Pending Evo Vault Order RPC</h1>

        {!authChecked ? <p className="mt-8 text-zinc-300">Checking authentication…</p> : null}

        {authChecked && !userId ? (
          <div className="mt-8 border border-amber-300/30 bg-amber-300/5 p-4">
            <p className="font-semibold text-amber-200">Authentication is required.</p>
            {authError ? <p className="mt-2 text-sm text-rose-300">Authentication error: {authError}</p> : null}
          </div>
        ) : null}

        {userId ? (
          <div className="mt-8 space-y-6">
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-bold text-zinc-400">Authenticated user UUID</dt>
                <dd className="mt-1 break-all font-mono text-sm">{userId}</dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-zinc-400">Product</dt>
                <dd className="mt-1">{PRODUCT_NAME}</dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-zinc-400">Product ID</dt>
                <dd className="mt-1 break-all font-mono text-sm">{PRODUCT_ID}</dd>
              </div>
            </dl>

            <button
              type="button"
              disabled={isCalling}
              onClick={createPendingOrder}
              className="button-primary px-5 py-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCalling ? 'Calling RPC…' : 'Create / Reuse Pending Order'}
            </button>

            {calls.map((result) => (
              <section key={result.call} className="border border-white/10 bg-black/30 p-4">
                <h2 className="font-semibold">Call {result.call}</h2>
                <div className="mt-4">
                  <h3 className="text-sm font-bold text-emerald-300">Complete RPC result</h3>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words bg-black p-4 text-sm text-zinc-200">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
                {result.error ? (
                  <div role="alert" className="mt-4 border border-rose-400/30 bg-rose-400/5 p-4">
                    <h3 className="text-sm font-bold text-rose-200">Supabase RPC error</h3>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-sm text-rose-100">
                      {JSON.stringify(result.error, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}
