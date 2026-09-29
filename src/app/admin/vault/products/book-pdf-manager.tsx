'use client'

import { ChangeEvent, FormEvent, useRef, useState, useTransition } from 'react'
import type { AdminVaultBookAsset } from '@/lib/admin-vault-book-assets'
import { createClient } from '@/lib/supabase/client'
import { VAULT_BOOK_PDF_ACCEPT, VAULT_BOOK_PDF_MAX_BYTES } from '@/lib/vault-book-pdf'
import {
  abortVaultBookPdfUploadAction,
  finalizeVaultBookPdfUploadAction,
  mutateVaultBookAssetAction,
  prepareVaultBookPdfUploadAction,
  type BookPdfActionState,
} from './book-pdf-actions'

const initialState: BookPdfActionState = {}
const input = 'mt-2 w-full border border-white/15 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-amber-300'
const label = 'block text-xs font-bold uppercase tracking-wider text-zinc-400'
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]

function Feedback({ state }: { state: BookPdfActionState }) {
  return <>
    {state.error ? <p role="alert" className="mt-4 border border-rose-400/30 bg-rose-400/5 p-3 text-sm text-rose-200">{state.error}</p> : null}
    {state.success ? <p role="status" className="mt-4 border border-emerald-400/30 bg-emerald-400/5 p-3 text-sm text-emerald-200">{state.success}</p> : null}
    {state.warning ? <p role="status" className="mt-3 border border-amber-300/30 bg-amber-300/5 p-3 text-sm text-amber-200">{state.warning}</p> : null}
  </>
}

function formattedBytes(bytes: number) {
  return `${(bytes / 1_048_576).toLocaleString(undefined, { maximumFractionDigits: 2 })} MB`
}

async function validatePdf(file: File | undefined) {
  if (!file || file.size === 0) return 'Choose a non-empty PDF to upload.'
  if (file.size > VAULT_BOOK_PDF_MAX_BYTES) return 'Book PDFs must be 50 MB or smaller.'
  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) return 'Choose a PDF file with the application/pdf content type.'
  const signature = new Uint8Array(await file.slice(0, PDF_SIGNATURE.length).arrayBuffer())
  if (signature.length !== PDF_SIGNATURE.length || !PDF_SIGNATURE.every((byte, index) => signature[index] === byte)) return 'The selected file does not begin with a valid PDF signature.'
  return null
}

function defaultTitle(filename: string) {
  const stem = filename.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim()
  return stem ? stem.replace(/\b\w/g, letter => letter.toUpperCase()) : 'Book PDF'
}

async function uploadOne(productId: string, assetId: string | null, file: File, title: string) {
  const validationError = await validatePdf(file)
  if (validationError) return { error: validationError }
  if (!title.trim()) return { error: 'Enter a customer-facing title for every PDF.' }
  const prepared = await prepareVaultBookPdfUploadAction(productId, assetId)
  if ('error' in prepared || !prepared.uploadId || !prepared.path || !prepared.bucket) return { error: prepared.error ?? 'The PDF upload could not be prepared.' }

  const upload = await createClient().storage.from(prepared.bucket).upload(prepared.path, file, { contentType: 'application/pdf', upsert: false })
  if (upload.error) {
    const cleanup = await abortVaultBookPdfUploadAction(productId, prepared.uploadId)
    return { error: assetId ? 'The replacement could not be uploaded. The existing PDF was preserved.' : 'The PDF could not be uploaded.', warning: cleanup.warning }
  }
  try {
    return await finalizeVaultBookPdfUploadAction(productId, prepared.uploadId, prepared.path, file.size, title)
  } catch {
    const cleanup = await abortVaultBookPdfUploadAction(productId, prepared.uploadId)
    return { error: 'The PDF upload could not be finalized.', warning: cleanup.warning }
  }
}

function AssetEditor({ asset, productId, position, count }: { asset: AdminVaultBookAsset; productId: string; position: number; count: number }) {
  const [title, setTitle] = useState(asset.title)
  const [state, setState] = useState<BookPdfActionState>(initialState)
  const [pending, startTransition] = useTransition()
  const replacement = useRef<HTMLInputElement>(null)

  function mutate(operation: 'rename' | 'primary' | 'up' | 'down' | 'remove') {
    startTransition(async () => setState(await mutateVaultBookAssetAction(productId, asset.id, operation, title)))
  }

  function replace(event: FormEvent) {
    event.preventDefault()
    const file = replacement.current?.files?.[0]
    startTransition(async () => {
      const result = file ? await uploadOne(productId, asset.id, file, title) : { error: 'Choose a replacement PDF.' }
      setState(result)
      if (result.success && replacement.current) replacement.current.value = ''
    })
  }

  return <article className={`border p-4 ${asset.isActive ? 'border-white/10 bg-black/20' : 'border-white/5 bg-black/10 opacity-70'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{asset.title}</h3>{asset.isPrimary ? <span className="border border-amber-300/40 px-2 py-0.5 text-[.65rem] font-bold uppercase text-amber-300">Primary</span> : null}<span className={`border px-2 py-0.5 text-[.65rem] font-bold uppercase ${asset.isActive ? 'border-emerald-400/30 text-emerald-300' : 'border-white/15 text-zinc-500'}`}>{asset.isActive ? 'Active' : 'Inactive'}</span></div><p className="mt-2 text-xs text-zinc-500">Protected PDF · {formattedBytes(asset.fileSize)}</p></div>
      {asset.isActive ? <div className="flex gap-2"><button type="button" aria-label={`Move ${asset.title} up`} disabled={pending || position === 0} onClick={() => mutate('up')} className="button-secondary px-3 py-2 text-xs font-bold">Up</button><button type="button" aria-label={`Move ${asset.title} down`} disabled={pending || position === count - 1} onClick={() => mutate('down')} className="button-secondary px-3 py-2 text-xs font-bold">Down</button></div> : null}
    </div>
    {asset.isActive ? <>
      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]"><div><label htmlFor={`asset-title-${asset.id}`} className={label}>Customer-facing title</label><input id={`asset-title-${asset.id}`} value={title} required maxLength={160} onChange={event => setTitle(event.target.value)} className={input} /></div><button type="button" disabled={pending || !title.trim() || title === asset.title} onClick={() => mutate('rename')} className="button-secondary self-end px-4 py-3 text-sm font-bold">Save title</button></div>
      <form onSubmit={replace} className="mt-5 border-t border-white/10 pt-5"><label htmlFor={`replace-${asset.id}`} className={label}>Replace PDF (optional)</label><input ref={replacement} id={`replace-${asset.id}`} type="file" accept={VAULT_BOOK_PDF_ACCEPT} className={`${input} file:mr-4 file:border-0 file:bg-amber-300 file:px-3 file:py-2 file:font-bold file:text-black`} /><p className="mt-2 text-xs text-zinc-500">The working file is retained unless the replacement is verified and attached successfully.</p><button disabled={pending || !title.trim()} className="button-secondary mt-3 px-4 py-2.5 text-sm font-bold">{pending ? 'Working…' : 'Replace file'}</button></form>
      <div className="mt-5 flex flex-wrap gap-4 border-t border-white/10 pt-5">{!asset.isPrimary ? <button type="button" disabled={pending} onClick={() => mutate('primary')} className="text-sm font-semibold text-amber-300 hover:text-amber-200">Make Primary</button> : null}<button type="button" disabled={pending} onClick={() => mutate('remove')} className="text-sm font-semibold text-rose-300 hover:text-rose-200">Remove PDF</button></div>
    </> : <p className="mt-4 text-xs text-zinc-500">Removed assets are retained as inactive audit metadata and are not available for delivery.</p>}
    <Feedback state={state} />
  </article>
}

export function BookPdfManager({ productId, assets, hasError }: { productId: string; assets: AdminVaultBookAsset[]; hasError: boolean }) {
  const [files, setFiles] = useState<File[]>([])
  const [titles, setTitles] = useState<string[]>([])
  const [state, setState] = useState<BookPdfActionState>(initialState)
  const [pending, startTransition] = useTransition()
  const picker = useRef<HTMLInputElement>(null)
  const activeAssets = assets.filter(asset => asset.isActive)

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    setFiles(selected)
    setTitles(selected.map(file => defaultTitle(file.name)))
    setState(initialState)
  }

  function addFiles(event: FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      for (let index = 0; index < files.length; index += 1) {
        const result = await uploadOne(productId, null, files[index], titles[index] ?? '')
        if (result.error) { setState({ ...result, error: `${files[index].name}: ${result.error}` }); return }
      }
      setState({ success: `${files.length} ${files.length === 1 ? 'PDF' : 'PDFs'} added.` })
      setFiles([]); setTitles([]); if (picker.current) picker.current.value = ''
    })
  }

  return <section className="mt-7 border border-amber-300/20 bg-zinc-950/40 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Digital Book Files</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Manage private customer PDFs, their display titles, order, and primary file. Secondary files remain admin-only until a later customer-delivery stage.</p>
    {hasError ? <p role="alert" className="mt-5 border border-rose-400/30 p-4 text-sm text-rose-200">PDF assets could not be loaded. Refresh before making changes.</p> : null}
    <form onSubmit={addFiles} className="mt-6 border border-dashed border-white/15 bg-black/20 p-4 sm:p-5">
      <h3 className="font-semibold">Add PDFs</h3><p className="mt-1 text-xs leading-5 text-zinc-500">Select one or more PDFs. Each file is privately uploaded and receives an editable customer-facing title.</p>
      <input ref={picker} type="file" multiple required accept={VAULT_BOOK_PDF_ACCEPT} disabled={pending || hasError} onChange={selectFiles} className={`${input} file:mr-4 file:border-0 file:bg-amber-300 file:px-3 file:py-2 file:font-bold file:text-black`} />
      {files.length ? <div className="mt-4 space-y-3">{files.map((file, index) => <div key={`${file.name}-${file.lastModified}`} className="grid gap-3 md:grid-cols-[1fr_2fr]"><p className="self-end truncate pb-3 text-sm text-zinc-400">{file.name} · {formattedBytes(file.size)}</p><div><label htmlFor={`new-pdf-title-${index}`} className={label}>Customer-facing title</label><input id={`new-pdf-title-${index}`} required maxLength={160} value={titles[index] ?? ''} onChange={event => setTitles(values => values.map((value, valueIndex) => valueIndex === index ? event.target.value : value))} className={input} /></div></div>)}</div> : null}
      <button disabled={pending || hasError || !files.length || titles.some(title => !title.trim())} className="button-primary mt-4 px-4 py-2.5 text-sm">{pending ? 'Uploading…' : `Add ${files.length > 1 ? `${files.length} PDFs` : 'PDF'}`}</button>
      <Feedback state={state} />
    </form>
    <div className="mt-6 space-y-4"><div className="flex items-center justify-between gap-4"><h3 className="font-semibold">Current files</h3><span className="text-xs uppercase tracking-wider text-zinc-500">{activeAssets.length} active</span></div>{!hasError && !assets.length ? <p className="border border-white/10 bg-black/20 p-5 text-sm text-zinc-500">No PDFs added yet.</p> : null}{assets.map(asset => <AssetEditor key={asset.id} asset={asset} productId={productId} position={activeAssets.findIndex(item => item.id === asset.id)} count={activeAssets.length} />)}</div>
  </section>
}
