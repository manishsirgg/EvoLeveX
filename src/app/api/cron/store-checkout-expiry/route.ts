import 'server-only'

import { createStoreCheckoutExpiryHandler, EXPIRY_BATCH_SIZE } from '@/lib/cron/store-checkout-expiry'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// maxDuration remains deployment-controlled until effective limits are verified.
export const GET = createStoreCheckoutExpiryHandler({
  secret: () => process.env.CRON_SECRET,
  createRpc: () => {
    const client = createServiceRoleClient()
    // Default POST RPC: separate PostgREST transaction on EVERY invocation.
    // Disable transport retries so three calls also means at most three requests.
    return signal => client.rpc('expire_evo_store_checkouts', { p_batch_size: EXPIRY_BATCH_SIZE })
      .retry(false).abortSignal(signal)
  },
})
