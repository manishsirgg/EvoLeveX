'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { DAILY_BLOCK_TYPES, DailyBlockType, safeHttpUrl } from '@/lib/daily-blocks'
import { DAILY_IMAGE_BUCKET, DAILY_IMAGE_MAX_BYTES, featuredImageExtension, hasValidImageSignature, ownedEditorialImagePath } from '@/lib/daily-featured-image'
import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim()
const optional = (value: string) => value || null
const fail = (articleId: string, message: string): never => redirect(`/admin/daily/${articleId}/edit?blockError=${encodeURIComponent(message)}`)
const logMutationError = (operation: 'insert' | 'update' | 'delete', articleId: string, blockId: string | null, error: { code?: string; message?: string; details?: string; hint?: string }) => {
  console.error(`Failed to ${operation} evo_daily_article_blocks`, {
    articleId, blockId, code: error.code ?? null, message: error.message ?? null,
    details: error.details ?? null, hint: error.hint ?? null,
  })
}

type ImageIntent = 'keep' | 'upload' | 'remove' | 'url'

async function validateEditorialImage(formData: FormData, blockType: DailyBlockType) {
  if (blockType !== 'image') return { intent: 'remove' as const }
  const intent = text(formData, 'image_intent') as ImageIntent
  if (!['keep', 'upload', 'remove', 'url'].includes(intent)) return { error: 'Choose a valid editorial image option.' }
  if (intent !== 'upload') return { intent }
  const file = formData.get('editorial_image')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image to upload.' }
  if (file.size > DAILY_IMAGE_MAX_BYTES) return { error: 'Editorial images must be 5 MB or smaller.' }
  const extension = featuredImageExtension(file)
  if (!extension || !(await hasValidImageSignature(file, extension))) return { error: 'Choose a valid JPG, PNG, or WebP image.' }
  return { intent, file, extension }
}

async function cleanupOwnedEditorialImage(supabase: Awaited<ReturnType<typeof createClient>>, url: string | null, articleId: string) {
  const path = ownedEditorialImagePath(url, articleId)
  if (path) await supabase.storage.from(DAILY_IMAGE_BUCKET).remove([path])
}

async function context(articleId: string) {
  await requireAdmin()
  if (!UUID.test(articleId)) fail(articleId, 'The article is invalid.')
  const supabase = await createClient()
  const { data } = await supabase.from('evo_daily_articles').select('id, slug').eq('id', articleId).maybeSingle()
  if (!data) fail(articleId, 'The article could not be found.')
  return { supabase, article: data as { id: string; slug: string } }
}

async function validateReference(supabase: Awaited<ReturnType<typeof createClient>>, type: DailyBlockType, id: string) {
  const config = type === 'evo_tv' ? ['evo_tv_videos', 'evo_tv_video_id', 'active'] : type === 'evo_vault' ? ['evo_vault_products', 'vault_product_id', 'is_active'] : type === 'evo_store' ? ['evo_store_products', 'store_product_id', 'is_active'] : null
  if (!config) return { valid: true, field: null }
  if (!UUID.test(id)) return { valid: false, field: config[1] }
  const { data } = await supabase.from(config[0]).select(`id, ${config[2]}`).eq('id', id).eq(config[2], true).maybeSingle()
  return { valid: Boolean(data), field: config[1] }
}

export async function saveBlockAction(articleId: string, blockId: string | null, formData: FormData): Promise<void> {
  const { supabase, article } = await context(articleId)
  const blockType = text(formData, 'block_type') as DailyBlockType
  if (!DAILY_BLOCK_TYPES.includes(blockType)) fail(articleId, 'Choose a supported block type.')
  const image = await validateEditorialImage(formData, blockType)
  if (image.error) fail(articleId, image.error)
  const positionValue = text(formData, 'position_after_paragraph'), sortValue = text(formData, 'sort_order')
  if (!/^\d+$/.test(positionValue) || !/^-?\d+$/.test(sortValue)) fail(articleId, 'Position and order must be whole numbers.')
  const imageUrl = text(formData, 'image_url'), externalUrl = text(formData, 'external_url')
  if (imageUrl && !safeHttpUrl(imageUrl)) fail(articleId, 'Image URLs must use HTTP or HTTPS.')
  if (blockType === 'image' && image.intent === 'url' && (!imageUrl || !safeHttpUrl(imageUrl))) fail(articleId, 'Enter an editorial image URL using HTTP or HTTPS.')
  const validDestination = !externalUrl || (blockType === 'cta' && externalUrl.startsWith('/') && !externalUrl.startsWith('//')) || safeHttpUrl(externalUrl)
  if (!validDestination) fail(articleId, 'Destination URLs must be a safe internal path or HTTP/HTTPS URL.')
  const referenceId = blockType === 'evo_tv' ? text(formData, 'evo_tv_video_id') : blockType === 'evo_vault' ? text(formData, 'vault_product_id') : blockType === 'evo_store' ? text(formData, 'store_product_id') : ''
  const reference = await validateReference(supabase, blockType, referenceId)
  if (!reference.valid) fail(articleId, 'Choose an active, available item for this promotion.')
  let existing: { id: string; image_url: string | null } | null = null
  if (blockId) {
    if (!UUID.test(blockId)) fail(articleId, 'The block is invalid.')
    const { data } = await supabase.from('evo_daily_article_blocks').select('id, image_url').eq('id', blockId).eq('article_id', articleId).maybeSingle()
    if (!data) fail(articleId, 'The block could not be found.')
    existing = data
  }
  const variant = blockType === 'image' && text(formData, 'variant') === 'wide' ? 'wide' : 'standard'
  const requestedImageUrl = blockType !== 'image' ? optional(imageUrl) : image.intent === 'remove' ? null : image.intent === 'url' ? imageUrl : existing?.image_url ?? null
  const payload = {
    article_id: articleId, block_type: blockType, position_after_paragraph: Number(positionValue), sort_order: Number(sortValue),
    heading: optional(text(formData, 'heading')), body: optional(text(formData, 'body')), image_url: requestedImageUrl, image_alt: optional(text(formData, 'image_alt')), caption: optional(text(formData, 'caption')),
    evo_tv_video_id: blockType === 'evo_tv' ? referenceId : null, vault_product_id: blockType === 'evo_vault' ? referenceId : null, store_product_id: blockType === 'evo_store' ? referenceId : null,
    external_url: optional(externalUrl), button_label: optional(text(formData, 'button_label')), affiliate_disclosure: optional(text(formData, 'affiliate_disclosure')),
    metadata: blockType === 'image' ? { variant } : {}, is_active: formData.get('is_active') === 'on',
  }
  // Insert first to establish a durable block identity. If upload then fails, the configured block remains retryable.
  const result = blockId
    ? { data: { id: blockId }, error: null }
    : await supabase.from('evo_daily_article_blocks').insert({ ...payload, image_url: null }).select('id').single()
  if (result.error || !result.data) {
    logMutationError(blockId ? 'update' : 'insert', articleId, blockId, result.error)
    fail(articleId, 'The magazine block could not be saved.')
  }
  const savedBlockId = result.data!.id
  let finalImageUrl = requestedImageUrl
  let uploadedPath: string | null = null
  if (blockType === 'image' && image.intent === 'upload' && image.file && image.extension) {
    uploadedPath = `articles/${articleId}/editorial/${crypto.randomUUID()}.${image.extension}`
    const upload = await supabase.storage.from(DAILY_IMAGE_BUCKET).upload(uploadedPath, image.file, { contentType: image.file.type, upsert: false })
    if (upload.error) fail(articleId, blockId ? 'The replacement could not be uploaded. The existing image was preserved.' : 'The block was created without an image. Edit it to retry the upload.')
    finalImageUrl = supabase.storage.from(DAILY_IMAGE_BUCKET).getPublicUrl(uploadedPath).data.publicUrl
  }
  const update = await supabase.from('evo_daily_article_blocks').update({ ...payload, image_url: finalImageUrl }).eq('id', savedBlockId).eq('article_id', articleId).select('id').single()
  if (update.error || !update.data) {
    if (uploadedPath) await supabase.storage.from(DAILY_IMAGE_BUCKET).remove([uploadedPath])
    logMutationError('update', articleId, savedBlockId, update.error ?? {})
    fail(articleId, 'The magazine block could not be saved. Its existing image was preserved.')
  }
  const oldImageUrl = existing?.image_url ?? null
  if (oldImageUrl && oldImageUrl !== finalImageUrl) await cleanupOwnedEditorialImage(supabase, oldImageUrl, articleId)
  revalidatePath(`/daily/${article.slug}`); revalidatePath(`/admin/daily/${articleId}/preview`)
  redirect(`/admin/daily/${articleId}/edit?blockSuccess=${blockId ? 'updated' : 'created'}#magazine-blocks`)
}

export async function deleteBlockAction(articleId: string, blockId: string, _formData: FormData): Promise<void> {
  void _formData
  const { supabase, article } = await context(articleId)
  if (!UUID.test(blockId)) fail(articleId, 'The block is invalid.')
  const { data: block } = await supabase.from('evo_daily_article_blocks').select('image_url, block_type').eq('id', blockId).eq('article_id', articleId).maybeSingle()
  if (!block) fail(articleId, 'The block could not be found.')
  const existingBlock = block as { image_url: string | null; block_type: DailyBlockType }
  const { error } = await supabase.from('evo_daily_article_blocks').delete().eq('id', blockId).eq('article_id', articleId)
  if (error) {
    logMutationError('delete', articleId, blockId, error)
    fail(articleId, 'The block could not be removed.')
  }
  if (existingBlock.block_type === 'image') await cleanupOwnedEditorialImage(supabase, existingBlock.image_url, articleId)
  revalidatePath(`/daily/${article.slug}`); revalidatePath(`/admin/daily/${articleId}/preview`)
  redirect(`/admin/daily/${articleId}/edit?blockSuccess=removed#magazine-blocks`)
}
