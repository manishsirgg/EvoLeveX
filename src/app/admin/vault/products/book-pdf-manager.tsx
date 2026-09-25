'use client'

import { ChangeEvent, FormEvent, useActionState, useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { VAULT_BOOK_PDF_ACCEPT, VAULT_BOOK_PDF_MAX_BYTES } from '@/lib/vault-book-pdf'
import { abortVaultBookPdfUploadAction, finalizeVaultBookPdfUploadAction, prepareVaultBookPdfUploadAction, removeVaultBookPdfAction } from './book-pdf-actions'

type BookPdfActionState = { error?: string; success?: string; warning?: string }
const initialState: BookPdfActionState = {}
const input = 'mt-3 w-full border border-white/15 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-amber-300'
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]

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

async function validatePdf(file: File | undefined) {
  if (!file || file.size === 0) return 'Choose a non-empty PDF to upload.'
  if (file.size > VAULT_BOOK_PDF_MAX_BYTES) return 'Book PDFs must be 50 MB or smaller.'
  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) return 'Choose a PDF file with the application/pdf content type.'
  const signature = new Uint8Array(await file.slice(0, PDF_SIGNATURE.length).arrayBuffer())
  if (signature.length !== PDF_SIGNATURE.length || !PDF_SIGNATURE.every((byte, index) => signature[index] === byte)) return 'The selected file does not begin with a valid PDF signature.'
  return null
}

export function BookPdfManager({ productId, path, size }: { productId: string; path: string | null; size: number | null }) {
  const removeAction = removeVaultBookPdfAction.bind(null, productId)
  const [removeState, removeFormAction, removePending] = useActionState(removeAction, initialState)
  const [uploadState, setUploadState] = useState<BookPdfActionState>(initialState)
  const [fileError, setFileError] = useState('')
  const [uploadPending, startUpload] = useTransition()
  const fileInput = useRef<HTMLInputElement>(null)

  function validateSelection(event: ChangeEvent<HTMLInputElement>) {
    void validatePdf(event.target.files?.[0]).then((error) => setFileError(error ?? ''))
  }

  function uploadPdf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = fileInput.current?.files?.[0]
    startUpload(async () => {
      setUploadState(initialState)
      const validationError = await validatePdf(file)
      setFileError(validationError ?? '')
      if (validationError || !file) return

      const prepared = await prepareVaultBookPdfUploadAction(productId)
      if ('error' in prepared || !prepared.uploadId || !prepared.path || !prepared.bucket) {
        setUploadState({ error: prepared.error ?? 'The PDF upload could not be prepared.' })
        return
      }

      const supabase = createClient()
      const upload = await supabase.storage.from(prepared.bucket).upload(prepared.path, file, {
        contentType: 'application/pdf',
        upsert: false,
      })
      if (upload.error) {
        await abortVaultBookPdfUploadAction(productId, prepared.uploadId)
        setUploadState({ error: path ? 'The replacement PDF could not be uploaded. The existing PDF was preserved.' : 'The PDF could not be uploaded. Please try again.' })
        return
      }

      try {
        const finalized = await finalizeVaultBookPdfUploadAction(productId, prepared.uploadId, prepared.path, file.size)
        setUploadState(finalized)
        if (finalized.success && fileInput.current) fileInput.current.value = ''
      } catch {
        const cleanup = await abortVaultBookPdfUploadAction(productId, prepared.uploadId)
        setUploadState({
          error: 'The PDF upload could not be finalized.',
          warning: cleanup.warning,
        })
      }
    })
  }

  const pending = uploadPending || removePending
  return <section className="mt-7 border border-amber-300/20 bg-zinc-950/40 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Digital Book File</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Manage the private PDF independently from the product details. No public or customer download link is created.</p>
    <div className="mt-5 border border-white/10 bg-black/20 p-4">
      {path ? <div><p className="font-semibold text-emerald-300">PDF uploaded</p><p className="mt-2 text-sm text-zinc-300">{formattedBytes(size)}</p><p className="mt-1 break-all font-mono text-xs text-zinc-500">{path}</p></div> : <p className="font-semibold text-zinc-300">No PDF uploaded</p>}
      <form onSubmit={uploadPdf} className="mt-5">
        <label htmlFor="book-pdf" className="block text-xs font-bold uppercase tracking-wider text-zinc-400">{path ? 'Replacement PDF' : 'PDF file'}</label>
        <input ref={fileInput} id="book-pdf" type="file" required accept={VAULT_BOOK_PDF_ACCEPT} disabled={pending} onChange={validateSelection} className={`${input} file:mr-4 file:border-0 file:bg-amber-300 file:px-3 file:py-2 file:font-bold file:text-black`} />
        <p className="mt-2 text-xs text-zinc-500">PDF only · maximum 50 MB. The file signature is checked in your browser before its direct private upload.</p>
        {fileError ? <p role="alert" className="mt-3 text-sm text-rose-300">{fileError}</p> : null}
        <button disabled={pending || Boolean(fileError)} className="button-primary mt-4 px-4 py-2.5 text-sm">{uploadPending ? 'Uploading…' : path ? 'Replace PDF' : 'Upload PDF'}</button>
      </form>
      <Feedback state={uploadState} />
      {path ? <form action={removeFormAction} className="mt-5 border-t border-white/10 pt-5">
        <button disabled={pending} className="button-danger px-4 py-2.5 text-sm">{removePending ? 'Removing…' : 'Remove PDF'}</button>
      </form> : null}
      <Feedback state={removeState} />
    </div>
  </section>
}
