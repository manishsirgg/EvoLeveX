'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { StoreAdminProductImage } from '@/lib/admin-store'
import { STORE_PRODUCT_IMAGE_ALT_MAX_LENGTH } from '@/lib/admin-store-validation'
import { setStoreProductImageActiveState, setStoreProductPrimaryImage, updateStoreProductImageMetadata, type StoreImageActionState } from './actions'

export function ProductImageCard({ image, readOnly }: { image: StoreAdminProductImage; readOnly: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<StoreImageActionState>({})
  const run = (action: () => Promise<StoreImageActionState>) => startTransition(async () => {
    setMessage({}); const result = await action(); setMessage(result); if (result.success) router.refresh()
  })
  return <article className="border border-white/10 bg-black/20 p-4">
    <div className="relative aspect-square overflow-hidden border border-white/10 bg-zinc-950">
      {image.preview_url ? <Image src={image.preview_url} alt={image.alt_text ?? ''} fill unoptimized className="object-contain" /> : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-zinc-500">Preview unavailable. The upload may be incomplete.</div>}
    </div>
    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider">
      {image.is_primary ? <span className="bg-amber-300 px-2 py-1 text-black">Primary</span> : null}
      <span className={image.is_active ? 'bg-emerald-400/15 px-2 py-1 text-emerald-200' : 'bg-zinc-700 px-2 py-1 text-zinc-300'}>{image.is_active ? 'Active' : 'Inactive'}</span>
    </div>
    {readOnly ? <dl className="mt-4 space-y-2 text-sm"><div><dt className="text-zinc-500">Alt text</dt><dd>{image.alt_text || 'None'}</dd></div><div><dt className="text-zinc-500">Sort order</dt><dd>{image.sort_order}</dd></div></dl> : <>
      <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); run(() => updateStoreProductImageMetadata(image.product_id, image.id, { altText: String(data.get('alt_text') ?? ''), sortOrder: String(data.get('sort_order') ?? '') })) }}>
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Alt text<input name="alt_text" maxLength={STORE_PRODUCT_IMAGE_ALT_MAX_LENGTH} defaultValue={image.alt_text ?? ''} className="mt-2 w-full border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" /></label>
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Sort order<input name="sort_order" type="number" min="0" step="1" required defaultValue={image.sort_order} className="mt-2 w-full border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" /></label>
        <button disabled={pending} className="button-secondary px-3 py-2 text-sm font-bold">Save details</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {image.is_active && !image.is_primary ? <button disabled={pending} onClick={() => run(() => setStoreProductPrimaryImage(image.product_id, image.id))} className="button-secondary px-3 py-2 text-sm font-bold">Set as primary</button> : null}
        {!image.is_primary ? <button disabled={pending} onClick={() => run(() => setStoreProductImageActiveState(image.product_id, image.id, !image.is_active))} className="button-secondary px-3 py-2 text-sm font-bold">{image.is_active ? 'Deactivate' : 'Activate'}</button> : null}
      </div>
    </>}
    {message.error ? <p role="alert" className="mt-3 text-sm text-rose-200">{message.error}</p> : null}
    {message.success ? <p role="status" className="mt-3 text-sm text-emerald-300">{message.success}</p> : null}
  </article>
}
