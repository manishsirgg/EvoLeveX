'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

type BrowserClient = ReturnType<typeof createClient>

export default function TestVaultOrderPage() {
  const supabaseRef = useRef<BrowserClient | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [productId, setProductId] = useState('')
  const [authError, setAuthError] = useState<unknown>(null)
  const [rpcData, setRpcData] = useState<unknown>(null)
  const [rpcError, setRpcError] = useState<unknown>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabaseRef.current = supabase
    let isCurrent = true

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!isCurrent) return

      setUserId(data.user?.id ?? null)
      setAuthError(error)
    })

    return () => {
      isCurrent = false
      supabaseRef.current = null
    }
  }, [])

  async function createPendingOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const supabase = supabaseRef.current
    if (!supabase || !userId || !productId.trim() || isSubmitting) return

    setIsSubmitting(true)
    setRpcData(null)
    setRpcError(null)

    const { data, error } = await supabase.rpc('create_pending_evo_vault_order', {
      p_vault_product_id: productId.trim(),
    })

    setRpcData(data)
    setRpcError(error)
    setIsSubmitting(false)
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12 text-zinc-100">
      <h1 className="text-2xl font-semibold">Test Vault order</h1>

      <dl className="mt-6 grid gap-2 text-sm">
        <div>
          <dt className="font-medium text-zinc-400">Authenticated user UUID</dt>
          <dd className="mt-1 break-all">{userId ?? 'No authenticated user found.'}</dd>
        </div>
      </dl>

      {authError ? (
        <pre className="mt-4 overflow-auto whitespace-pre-wrap text-sm text-rose-300">
          {JSON.stringify(authError, null, 2)}
        </pre>
      ) : null}

      <form className="mt-8 grid gap-4" onSubmit={createPendingOrder}>
        <label className="grid gap-2 text-sm font-medium" htmlFor="vault-product-id">
          Vault product UUID
          <input
            id="vault-product-id"
            className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        </label>
        <button
          type="submit"
          className="w-fit border border-amber-300 px-4 py-2 font-medium text-amber-300 disabled:opacity-50"
          disabled={!userId || !productId.trim() || isSubmitting}
        >
          {isSubmitting ? 'Creating…' : 'Create pending order'}
        </button>
      </form>

      <section className="mt-8 grid gap-4" aria-live="polite">
        <div>
          <h2 className="font-medium">RPC data</h2>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap text-sm">
            {rpcData === null ? 'No RPC data yet.' : JSON.stringify(rpcData, null, 2)}
          </pre>
        </div>
        <div>
          <h2 className="font-medium">RPC error</h2>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap text-sm text-rose-300">
            {rpcError === null ? 'No RPC error.' : JSON.stringify(rpcError, null, 2)}
          </pre>
        </div>
      </section>
    </main>
  )
}
