'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { parseStoreProductImageFile } from '@/lib/admin-store-validation'
import { finalizeStoreProductImageUpload, prepareStoreProductImageUpload } from './actions'

export function ProductImageUpload({ productId }: { productId: string }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ error?: string; success?: string }>({})
  const [pending, setPending] = useState(false)

  async function upload() {
    const file = input.current?.files?.[0]
    if (!file) return setMessage({ error: 'Choose an image to upload.' })
    const validated = parseStoreProductImageFile({ name: file.name, type: file.type, size: file.size })
    if (!validated.success) return setMessage({ error: validated.error })
    setPending(true); setMessage({})
    const prepared = await prepareStoreProductImageUpload(productId, { name: file.name, type: file.type, size: file.size })
    if (!prepared.upload) { setPending(false); return setMessage({ error: prepared.error ?? 'The upload could not be prepared.' }) }
    const supabase = createClient()
    const { error } = await supabase.storage.from(prepared.upload.bucket).upload(prepared.upload.path, file, {
      contentType: prepared.upload.contentType,
      upsert: false,
    })
    if (error) {
      setPending(false)
      return setMessage({ error: error.message.toLowerCase().includes('exist') ? 'An object already exists at this upload location. Refresh and try again.' : 'The image upload failed. You can safely retry with the file.' })
    }
    const finalized = await finalizeStoreProductImageUpload(productId, prepared.upload.imageId)
    setPending(false); setMessage(finalized)
    if (finalized.success) { if (input.current) input.current.value = ''; router.refresh() }
  }

  return <div className="mt-5 border border-white/10 bg-black/20 p-4">
    <label htmlFor="store-product-image" className="block text-xs font-bold uppercase tracking-[0.13em] text-zinc-400">Upload image</label>
    <input ref={input} id="store-product-image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={pending} className="mt-3 block w-full text-sm text-zinc-300 file:mr-4 file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:font-bold file:text-black" />
    <p className="mt-2 text-xs text-zinc-500">JPEG, PNG, WebP, or AVIF · maximum 5 MiB.</p>
    {message.error ? <p role="alert" className="mt-3 text-sm text-rose-200">{message.error}</p> : null}
    {message.success ? <p role="status" className="mt-3 text-sm text-emerald-300">{message.success}</p> : null}
    <button type="button" onClick={upload} disabled={pending} className="button-primary mt-4 px-4 py-2 text-sm">{pending ? 'Uploading…' : 'Upload image'}</button>
  </div>
}
