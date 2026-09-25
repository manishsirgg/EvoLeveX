'use client'

import { ChangeEvent, useActionState, useState } from 'react'
import type { VaultProductImage } from '@/lib/vault-gallery'
import { VAULT_GALLERY_ACCEPT, VAULT_GALLERY_MAX_BYTES } from '@/lib/vault-gallery-image'
import {
  initialGalleryState,
  removeVaultGalleryImageAction,
  updateVaultGalleryImageAction,
  uploadVaultGalleryImageAction,
} from './gallery-actions'

const input = 'mt-2 w-full border border-white/15 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-amber-300'
const label = 'block text-xs font-bold uppercase tracking-wider text-zinc-400'

function GalleryFeedback({ state }: { state: typeof initialGalleryState }) {
  return <>
    {state.error ? <p role="alert" className="mt-4 border border-rose-400/30 bg-rose-400/5 p-3 text-sm text-rose-200">{state.error}</p> : null}
    {state.success ? <p role="status" className="mt-4 border border-emerald-400/30 bg-emerald-400/5 p-3 text-sm text-emerald-200">{state.success}</p> : null}
    {state.warning ? <p role="status" className="mt-3 border border-amber-300/30 bg-amber-300/5 p-3 text-sm text-amber-200">{state.warning}</p> : null}
  </>
}

function clientImageError(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0]
  if (!file) return ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPG, PNG, or WebP image.'
  if (file.size > VAULT_GALLERY_MAX_BYTES) return 'Gallery images must be 5 MB or smaller.'
  return ''
}

function GalleryImageEditor({ image, productId }: { image: VaultProductImage; productId: string }) {
  const updateAction = updateVaultGalleryImageAction.bind(null, productId, image.id)
  const removeAction = removeVaultGalleryImageAction.bind(null, productId, image.id)
  const [updateState, updateFormAction, updatePending] = useActionState(updateAction, initialGalleryState)
  const [removeState, removeFormAction, removePending] = useActionState(removeAction, initialGalleryState)
  const [fileError, setFileError] = useState('')

  return <article className="grid gap-5 border border-white/10 bg-black/20 p-4 lg:grid-cols-[14rem_1fr]">
    {/* Public URLs can point at the existing Supabase project, which is intentionally not coupled to Next Image configuration. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={image.public_url} alt={image.alt_text ?? ''} className="aspect-square w-full border border-white/10 bg-zinc-950 object-cover" />
    <div>
      <form action={updateFormAction}>
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <div><label htmlFor={`gallery-alt-${image.id}`} className={label}>Alt text</label><input id={`gallery-alt-${image.id}`} name="alt_text" defaultValue={image.alt_text ?? ''} className={input} placeholder="Describe this image" /></div>
          <div><label htmlFor={`gallery-sort-${image.id}`} className={label}>Sort order</label><input id={`gallery-sort-${image.id}`} name="sort_order" type="number" min="0" step="1" required defaultValue={image.sort_order} className={input} /></div>
        </div>
        <div className="mt-4"><label htmlFor={`gallery-file-${image.id}`} className={label}>Replace image (optional)</label><input id={`gallery-file-${image.id}`} name="gallery_image" type="file" accept={VAULT_GALLERY_ACCEPT} onChange={event => setFileError(clientImageError(event))} className={`${input} file:mr-4 file:border-0 file:bg-amber-300 file:px-3 file:py-2 file:font-bold file:text-black`} /><p className="mt-2 text-xs text-zinc-500">Leave empty to update only the alt text and sort order.</p></div>
        {fileError ? <p role="alert" className="mt-3 text-sm text-rose-300">{fileError}</p> : null}
        <button disabled={updatePending || Boolean(fileError)} className="button-secondary mt-4 px-4 py-2.5 text-sm font-bold">{updatePending ? 'Saving…' : 'Save gallery image'}</button>
      </form>
      <GalleryFeedback state={updateState} />
      <form action={removeFormAction} className="mt-4 border-t border-white/10 pt-4">
        <button disabled={removePending} className="text-sm font-semibold text-rose-300 hover:text-rose-200">{removePending ? 'Removing…' : 'Remove image'}</button>
      </form>
      <GalleryFeedback state={removeState} />
    </div>
  </article>
}

export function ProductGalleryManager({ productId, images, hasError }: { productId: string; images: VaultProductImage[]; hasError: boolean }) {
  const uploadAction = uploadVaultGalleryImageAction.bind(null, productId)
  const [state, formAction, pending] = useActionState(uploadAction, initialGalleryState)
  const [fileError, setFileError] = useState('')

  return <section className="mt-7 border border-amber-300/20 bg-zinc-950/40 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Product Gallery</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">The primary cover is managed in Product details above. Add separate supporting product images here; gallery actions never change or duplicate the cover.</p>
    {hasError ? <p role="alert" className="mt-5 border border-rose-400/30 bg-rose-400/5 p-4 text-sm text-rose-200">The gallery could not be loaded. Refresh before making changes.</p> : null}

    <form action={formAction} className="mt-6 border border-dashed border-white/15 bg-black/20 p-4 sm:p-5">
      <h3 className="font-semibold">Add an image</h3>
      <p className="mt-1 text-xs leading-5 text-zinc-500">Upload one JPG, PNG, or WebP image at a time, up to 5 MB.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_9rem]">
        <div><label htmlFor="new-gallery-image" className={label}>Image</label><input id="new-gallery-image" name="gallery_image" type="file" accept={VAULT_GALLERY_ACCEPT} required onChange={event => setFileError(clientImageError(event))} className={`${input} file:mr-4 file:border-0 file:bg-amber-300 file:px-3 file:py-2 file:font-bold file:text-black`} /></div>
        <div><label htmlFor="new-gallery-alt" className={label}>Alt text</label><input id="new-gallery-alt" name="alt_text" className={input} placeholder="Describe this image" /></div>
        <div><label htmlFor="new-gallery-sort" className={label}>Sort order</label><input id="new-gallery-sort" name="sort_order" type="number" min="0" step="1" required defaultValue="0" className={input} /></div>
      </div>
      {fileError ? <p role="alert" className="mt-3 text-sm text-rose-300">{fileError}</p> : null}
      <button disabled={pending || hasError || Boolean(fileError)} className="button-primary mt-4 px-4 py-2.5 text-sm">{pending ? 'Uploading…' : 'Upload gallery image'}</button>
      <GalleryFeedback state={state} />
    </form>

    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between gap-4"><h3 className="font-semibold">Current images</h3><span className="text-xs uppercase tracking-wider text-zinc-500">{images.length} {images.length === 1 ? 'image' : 'images'}</span></div>
      {!hasError && images.length === 0 ? <p className="border border-white/10 bg-black/20 p-5 text-sm text-zinc-500">No additional gallery images yet.</p> : null}
      {images.map(image => <GalleryImageEditor key={image.id} image={image} productId={productId} />)}
    </div>
  </section>
}
