'use client'

import { useEffect, useRef, useState } from 'react'
import { BlockComposerData } from '@/lib/admin-daily-editor'
import { DAILY_BLOCK_LABELS, DAILY_BLOCK_TYPES, DailyBlock, DailyBlockType } from '@/lib/daily-blocks'
import { paragraphPositionOptions } from '@/lib/daily-paragraphs'
import { deleteBlockAction, saveBlockAction } from './block-actions'
import { DAILY_IMAGE_ACCEPT } from '@/lib/daily-featured-image'

const input = 'mt-2 w-full border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white focus:border-amber-300 focus:outline-none'
const label = 'block text-xs font-bold uppercase tracking-wider text-zinc-400'
const relevant: Record<DailyBlockType, string[]> = {
  section_heading: ['heading', 'body'], pull_quote: ['body', 'heading'], divider: [], image: ['image_url', 'image_alt', 'caption', 'variant'], callout: ['heading', 'body'], evo_tv: ['evo_tv_video_id'], evo_vault: ['vault_product_id'], evo_store: ['store_product_id'], affiliate: ['heading', 'body', 'image_url', 'image_alt', 'external_url', 'button_label', 'affiliate_disclosure'], cta: ['heading', 'body', 'external_url', 'button_label'],
}
const blank = { block_type: 'section_heading' as DailyBlockType, position_after_paragraph: 0, sort_order: 0, heading: null, body: null, image_url: null, image_alt: null, caption: null, evo_tv_video_id: null, vault_product_id: null, store_product_id: null, external_url: null, button_label: null, affiliate_disclosure: null, metadata: {}, is_active: true }

function EditorialImageManager({ imageUrl }: { imageUrl: string | null }) {
  const [intent, setIntent] = useState<'keep' | 'upload' | 'remove' | 'url'>(imageUrl ? 'keep' : 'upload')
  const [preview, setPreview] = useState<string | null>(imageUrl)
  const localPreview = useRef<string | null>(null)
  useEffect(() => () => { if (localPreview.current) URL.revokeObjectURL(localPreview.current) }, [])

  function chooseFile(file: File | undefined) {
    if (localPreview.current) URL.revokeObjectURL(localPreview.current)
    localPreview.current = file ? URL.createObjectURL(file) : null
    setPreview(localPreview.current ?? imageUrl)
  }

  return <div className="md:col-span-2 border border-white/10 bg-black/20 p-4">
    <input type="hidden" name="image_intent" value={intent} />
    <p className={label}>Editorial image</p>
    {/* Blob and administrator-configured external URLs cannot use a fixed Next Image host allowlist. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {preview && intent !== 'remove' && intent !== 'url' && <img src={preview} alt="Current editorial image preview" className="mt-3 max-h-64 w-full bg-black object-contain" />}
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={() => setIntent('upload')} className="border border-amber-300/50 px-3 py-2 text-sm font-semibold text-amber-200">{imageUrl ? 'Replace image' : 'Upload image'}</button>
      {imageUrl && <button type="button" onClick={() => { setIntent('keep'); setPreview(imageUrl) }} className="border border-white/15 px-3 py-2 text-sm text-zinc-300">Keep current</button>}
      <button type="button" onClick={() => setIntent('url')} className="border border-white/15 px-3 py-2 text-sm text-zinc-300">Use image URL instead</button>
      {(imageUrl || preview) && <button type="button" onClick={() => setIntent('remove')} className="border border-rose-300/30 px-3 py-2 text-sm text-rose-300">Remove image</button>}
    </div>
    {intent === 'upload' && <label className={`${label} mt-4`}>{imageUrl ? 'Replacement image' : 'Upload image'}<input name="editorial_image" type="file" accept={DAILY_IMAGE_ACCEPT} required onChange={(event) => chooseFile(event.target.files?.[0])} className={`${input} file:mr-3 file:border-0 file:bg-amber-300 file:px-3 file:py-1 file:font-semibold file:text-black`} /><span className="mt-2 block normal-case tracking-normal text-zinc-500">JPG, PNG, or WebP. Maximum 5 MB.</span></label>}
    {intent === 'url' && <label className={`${label} mt-4`}>Image URL<input name="image_url" type="url" required defaultValue={imageUrl ?? ''} placeholder="https://…" className={input} /></label>}
    {intent === 'remove' && <p className="mt-3 text-sm text-zinc-400">The image will be cleared when you save this block.</p>}
  </div>
}

function BlockForm({ articleId, block, data, content, onCancel }: { articleId: string; block?: DailyBlock; data: BlockComposerData; content: string; onCancel(): void }) {
  const model = block ?? blank
  const [type, setType] = useState<DailyBlockType>(model.block_type)
  const fields = relevant[type]
  const action = saveBlockAction.bind(null, articleId, block?.id ?? null)
  return <form action={action} className="mt-5 border border-amber-300/20 bg-black/20 p-4 sm:p-5">
    <div className="grid gap-4 md:grid-cols-3"><label className={label}>Block type<select name="block_type" value={type} onChange={(e) => setType(e.target.value as DailyBlockType)} className={input}>{DAILY_BLOCK_TYPES.map((value) => <option key={value} value={value}>{DAILY_BLOCK_LABELS[value]}</option>)}</select></label><label className={`${label} md:col-span-2`}>Insertion position<select name="position_after_paragraph" defaultValue={model.position_after_paragraph} className={input}>{paragraphPositionOptions(content).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {fields.includes('heading') && <label className={label}>{type === 'pull_quote' ? 'Attribution / context' : type === 'section_heading' ? 'Section heading / title' : 'Heading'}<input name="heading" required={type === 'section_heading'} defaultValue={model.heading ?? ''} className={input} /></label>}
      {fields.includes('body') && <label className={`${label} md:col-span-2`}>{type === 'pull_quote' ? 'Quote' : 'Body'}<textarea name="body" rows={4} defaultValue={model.body ?? ''} className={input} /></label>}
      {type === 'image' && <EditorialImageManager imageUrl={model.block_type === 'image' ? model.image_url : null} />}
      {type !== 'image' && fields.includes('image_url') && <label className={label}>Image URL<input name="image_url" type="url" defaultValue={model.image_url ?? ''} className={input} /></label>}
      {fields.includes('image_alt') && <label className={label}>{type === 'image' ? 'Image Alt Text' : 'Alt text'}<input name="image_alt" defaultValue={model.image_alt ?? ''} className={input} />{type === 'image' && <span className="mt-2 block normal-case tracking-normal text-zinc-500">Describe the meaningful visual content for people using assistive technology.</span>}</label>}
      {fields.includes('caption') && <label className={`${label} md:col-span-2`}>Caption<input name="caption" defaultValue={model.caption ?? ''} className={input} /></label>}
      {fields.includes('variant') && <label className={label}>Presentation<select name="variant" defaultValue={'variant' in model.metadata && model.metadata.variant === 'wide' ? 'wide' : 'standard'} className={input}><option value="standard">Standard</option><option value="wide">Wide</option></select></label>}
      {fields.includes('external_url') && <label className={label}>Destination URL<input name="external_url" defaultValue={model.external_url ?? ''} className={input} placeholder={type === 'cta' ? '/internal or https://…' : 'https://…'} /></label>}
      {fields.includes('button_label') && <label className={label}>Button label<input name="button_label" defaultValue={model.button_label ?? ''} className={input} /></label>}
      {fields.includes('affiliate_disclosure') && <label className={`${label} md:col-span-2`}>Affiliate disclosure<input name="affiliate_disclosure" defaultValue={model.affiliate_disclosure ?? ''} className={input} /></label>}
      {fields.includes('evo_tv_video_id') && <label className={`${label} md:col-span-2`}>Evo TV video<select required name="evo_tv_video_id" defaultValue={model.evo_tv_video_id ?? ''} className={input}><option value="">{data.videos.length ? 'Choose a video' : 'No active videos available'}</option>{data.videos.map((v) => <option key={v.id} value={v.id}>{v.title}{v.published_at ? ` — ${new Date(v.published_at).toLocaleDateString()}` : ''}</option>)}</select></label>}
      {fields.includes('vault_product_id') && <label className={`${label} md:col-span-2`}>Evo Vault product<select required name="vault_product_id" defaultValue={model.vault_product_id ?? ''} className={input}><option value="">{data.vaultProducts.length ? 'Choose a product' : 'No active Vault products available'}</option>{data.vaultProducts.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.kind} · {p.currency} {p.price}</option>)}</select></label>}
      {fields.includes('store_product_id') && <label className={`${label} md:col-span-2`}>Evo Store product<select required name="store_product_id" defaultValue={model.store_product_id ?? ''} className={input}><option value="">{data.storeProducts.length ? 'Choose a product' : 'No active Store products available'}</option>{data.storeProducts.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.currency} {p.base_price}</option>)}</select></label>}
    </div>
    <div className="mt-4 flex flex-wrap items-end gap-4"><label className={label}>Order at position<input name="sort_order" type="number" step="1" defaultValue={model.sort_order} className={`${input} w-32`} /></label><label className="flex items-center gap-2 pb-2 text-sm text-zinc-300"><input name="is_active" type="checkbox" defaultChecked={model.is_active} className="accent-amber-300" /> Active</label><button className="bg-amber-300 px-4 py-2.5 text-sm font-bold text-black">Save block</button><button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-zinc-400">Cancel</button></div>
  </form>
}

export function MagazineBlockComposer({ articleId, content, data, error, success }: { articleId: string; content: string; data: BlockComposerData; error?: string; success?: string }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  return <section id="magazine-blocks" className="mt-7 border border-white/10 bg-zinc-950/40 p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">Editorial composition</p><h2 className="mt-2 text-2xl font-semibold">Magazine Blocks</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Place controlled editorial elements between the article&apos;s plain-text paragraphs.</p></div><button type="button" onClick={() => setEditing('new')} className="border border-amber-300/50 px-4 py-2.5 text-sm font-bold text-amber-200">Add block</button></div>
    {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}{success && <p role="status" className="mt-4 text-sm text-emerald-300">Block {success}.</p>}{data.hasError && <p className="mt-4 text-sm text-amber-200">Could not load {data.failedSources.join(', ')}. Refresh before editing.</p>}
    {editing === 'new' && <BlockForm articleId={articleId} content={content} data={data} onCancel={() => setEditing(null)} />}
    <div className="mt-6 space-y-3">{data.blocks.length ? data.blocks.map((block) => <div key={block.id} className="border border-white/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{DAILY_BLOCK_LABELS[block.block_type]}</strong><p className="mt-1 text-xs text-zinc-500">After paragraph {block.position_after_paragraph} · order {block.sort_order} · {block.is_active ? 'Active' : 'Inactive'}{block.heading ? ` · ${block.heading}` : ''}</p></div><div className="flex gap-3"><button type="button" onClick={() => setEditing(editing === block.id ? null : block.id)} className="text-sm font-semibold text-amber-200">Edit</button><form action={deleteBlockAction.bind(null, articleId, block.id)}><button className="text-sm font-semibold text-rose-300">Remove</button></form></div></div>{editing === block.id && <BlockForm articleId={articleId} block={block} content={content} data={data} onCancel={() => setEditing(null)} />}</div>) : <p className="border border-dashed border-white/15 p-6 text-sm text-zinc-500">No magazine blocks yet. The article will render as clean editorial text.</p>}</div>
  </section>
}
