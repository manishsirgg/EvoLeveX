import { NextRequest, NextResponse } from 'next/server'

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createClient } from '@/lib/supabase/server'
import { getDeliverableLegacyVaultBook, getDeliverableVaultAsset } from '@/lib/vault-access'
import { VAULT_BOOK_PDF_BUCKET } from '@/lib/vault-book-pdf'
import { isSameOrigin } from '@/lib/view-tracking'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SIGNED_URL_TTL_SECONDS = 60

function json(body: object, status = 200) {
  const response = NextResponse.json(body, { status })
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

function downloadFilename(name: string) {
  const safe = name.normalize('NFKD').replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim().replace(/\s+/g, '-').slice(0, 100)
  return `${safe || 'evo-vault-book'}.pdf`
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: 'Invalid request origin' }, 403)

  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'Invalid request body' }, 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1) {
    return json({ error: 'Invalid request body' }, 400)
  }
  const requestId = 'assetId' in body && typeof body.assetId === 'string' && UUID.test(body.assetId)
    ? { kind: 'asset' as const, id: body.assetId }
    : 'productId' in body && typeof body.productId === 'string' && UUID.test(body.productId)
      ? { kind: 'legacy' as const, id: body.productId }
      : null
  if (!requestId) return json({ error: 'Invalid request body' }, 400)

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Authentication required' }, 401)

  const delivery = requestId.kind === 'asset'
    ? await getDeliverableVaultAsset(supabase, user.id, requestId.id)
    : await getDeliverableLegacyVaultBook(supabase, user.id, requestId.id)
  if (!delivery) return json({ error: 'Book download unavailable' }, 404)

  const infrastructure = createServiceRoleClient()
  const signed = await infrastructure.storage.from(VAULT_BOOK_PDF_BUCKET)
    .createSignedUrl(delivery.filePath, SIGNED_URL_TTL_SECONDS, {
      download: downloadFilename(delivery.assetTitle || delivery.productName),
    })
  if (signed.error || !signed.data?.signedUrl) {
    console.error('Vault download signing failed', { productId: delivery.productId })
    return json({ error: 'Book download unavailable' }, 503)
  }

  const userAgent = request.headers.get('user-agent')?.slice(0, 500) || null
  const audit = await infrastructure.from('digital_download_logs').insert({
    user_id: user.id,
    digital_access_id: delivery.accessId,
    asset_id: delivery.assetId,
    file_path: delivery.filePath,
    user_agent: userAgent,
    metadata: { event: 'signed_url_issued' },
  })
  if (audit.error) {
    console.error('Vault download audit failed', { productId: delivery.productId })
    return json({ error: 'Book download unavailable' }, 503)
  }

  return json({ url: signed.data.signedUrl })
}
