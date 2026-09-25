'use client'

import { ChangeEvent, useActionState, useState } from 'react'
import { VAULT_BOOK_PDF_ACCEPT, VAULT_BOOK_PDF_MAX_BYTES } from '@/lib/vault-book-pdf'
import { removeVaultBookPdfAction, uploadVaultBookPdfAction } from './book-pdf-actions'

type BookPdfActionState = { error?: string; success?: string; warning?: string }
const initialState: BookPdfActionState = {}
const input = 'mt-3 w-full border border-white/15 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-amber-300'

function Feedback({ state }: { state: BookPdfActionState }) {
  return <>
    {state.error ? <p role="alert" className="mt-4 border border-rose-400/30 bg-rose-400/5 p-3 text-sm text-rose-200">{state.error}</p> : null}
    {state.success ? <p role="status" className="mt-4 border border-emerald-400/30 bg-emerald-400/5 p-3 text-sm text-emerald-200">{state.success}</p> : null}
    {state.warning ? <p role="status" className="mt-3 border border-amber-300/30 bg-amber-300/5 p-3 text-sm text-amber-200">{state.warning}</p> : null}
  </>
}

function formattedBytes(bytes: number | null) {
  if (bytes === null) return 'Size unavailable'
  return `${(bytes / 1_048_576).toLocaleString(undefined, { maximumFractionDigits: 2 })} MB`
}

export function BookPdfManager({ productId, path, size }: { productId: string; path: string | null; size: number | null }) {
  const uploadAction = uploadVaultBookPdfAction.bind(null, productId)
  const removeAction = removeVaultBookPdfAction.bind(null, productId)
  const [uploadState, uploadFormAction, uploadPending] = useActionState(uploadAction, initialState)
  const [removeState, removeFormAction, removePending] = useActionState(removeAction, initialState)
  const [fileError, setFileError] = useState('')

  function validateSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return setFileError('')
    if (file.size === 0) return setFileError('Choose a non-empty PDF to upload.')
    if (file.size > VAULT_BOOK_PDF_MAX_BYTES) return setFileError('Book PDFs must be 50 MB or smaller.')
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) return setFileError('Choose a PDF file.')
    setFileError('')
  }

  return <section className="mt-7 border border-amber-300/20 bg-zinc-950/40 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Digital Book File</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Manage the private PDF independently from the product details. No public or customer download link is created.</p>
    <div className="mt-5 border border-white/10 bg-black/20 p-4">
      {path ? <div><p className="font-semibold text-emerald-300">PDF uploaded</p><p className="mt-2 text-sm text-zinc-300">{formattedBytes(size)}</p><p className="mt-1 break-all font-mono text-xs text-zinc-500">{path}</p></div> : <p className="font-semibold text-zinc-300">No PDF uploaded</p>}
      <form action={uploadFormAction} className="mt-5">
        <label htmlFor="book-pdf" className="block text-xs font-bold uppercase tracking-wider text-zinc-400">{path ? 'Replacement PDF' : 'PDF file'}</label>
        <input id="book-pdf" name="book_pdf" type="file" required accept={VAULT_BOOK_PDF_ACCEPT} onChange={validateSelection} className={`${input} file:mr-4 file:border-0 file:bg-amber-300 file:px-3 file:py-2 file:font-bold file:text-black`} />
        <p className="mt-2 text-xs text-zinc-500">PDF only · maximum 50 MB. The file content is verified before it is attached.</p>
        {fileError ? <p role="alert" className="mt-3 text-sm text-rose-300">{fileError}</p> : null}
        <button disabled={uploadPending || Boolean(fileError)} className="button-primary mt-4 px-4 py-2.5 text-sm">{uploadPending ? 'Uploading…' : path ? 'Replace PDF' : 'Upload PDF'}</button>
      </form>
      <Feedback state={uploadState} />
      {path ? <form action={removeFormAction} className="mt-5 border-t border-white/10 pt-5">
        <button disabled={removePending} className="button-danger px-4 py-2.5 text-sm">{removePending ? 'Removing…' : 'Remove PDF'}</button>
      </form> : null}
      <Feedback state={removeState} />
    </div>
  </section>
}
