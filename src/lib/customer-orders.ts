import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export const ORDER_LIST_COLUMNS = 'id,status,payment_status,total_amount,currency,created_at'
export const ORDER_DETAIL_COLUMNS = 'id,status,payment_status,subtotal,discount_amount,shipping_amount,tax_amount,total_amount,currency,created_at'
export const ORDER_ITEM_COLUMNS = 'id,source,vault_product_id,product_name_snapshot,sku_snapshot,quantity,unit_price,discount_amount,total_price'
export const PAYMENT_COLUMNS = 'provider,status,amount,currency,refunded_amount,paid_at,refunded_at'
export const ACCESS_COLUMNS = 'vault_product_id,status,expires_at,revoked_at'

export type CustomerOrder = {
  id: string
  status: string
  payment_status: string
  total_amount: number | string
  currency: string
  created_at: string
}

export type CustomerOrderItem = {
  id: string
  source: string
  vault_product_id: string | null
  product_name_snapshot: string
  sku_snapshot: string | null
  quantity: number
  unit_price: number | string
  discount_amount: number | string
  total_price: number | string
}

export type CustomerPayment = {
  provider: string
  status: string
  amount: number | string
  currency: string
  refunded_amount: number | string
  paid_at: string | null
  refunded_at: string | null
}

export type CustomerOrderDetail = CustomerOrder & {
  subtotal: number | string
  discount_amount: number | string
  shipping_amount: number | string
  tax_amount: number | string
  items: CustomerOrderItem[]
  payments: CustomerPayment[]
  activeVaultProductIds: Set<string>
}

type Result<T> = { data: T; error: null } | { data: null; error: unknown }

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function orderReference(id: string) {
  return `EVX-${id.replaceAll('-', '').slice(0, 10).toUpperCase()}`
}

/** Every query uses the request's cookie-authenticated client and remains RLS-scoped. */
export async function getCustomerOrders(supabase: SupabaseClient): Promise<Result<CustomerOrder[]>> {
  const result = await supabase.from('orders').select(ORDER_LIST_COLUMNS)
    .order('created_at', { ascending: false }).order('id', { ascending: false })
  if (result.error) return { data: null, error: result.error }
  return { data: (result.data ?? []) as CustomerOrder[], error: null }
}

export async function getCustomerOrder(supabase: SupabaseClient, orderId: string): Promise<Result<CustomerOrderDetail | null>> {
  if (!isUuid(orderId)) return { data: null, error: null }

  // The UUID only identifies a candidate. RLS is the ownership check, and maybeSingle
  // deliberately makes a missing and a different customer's order indistinguishable.
  const orderResult = await supabase.from('orders').select(ORDER_DETAIL_COLUMNS)
    .eq('id', orderId).maybeSingle()
  if (orderResult.error) return { data: null, error: orderResult.error }
  if (!orderResult.data) return { data: null, error: null }

  const [itemsResult, paymentsResult] = await Promise.all([
    supabase.from('order_items').select(ORDER_ITEM_COLUMNS).eq('order_id', orderId).order('id'),
    supabase.from('payments').select(PAYMENT_COLUMNS).eq('order_id', orderId).order('paid_at', { ascending: false }),
  ])
  if (itemsResult.error || paymentsResult.error) {
    return { data: null, error: itemsResult.error ?? paymentsResult.error }
  }

  const items = (itemsResult.data ?? []) as CustomerOrderItem[]
  const vaultProductIds = [...new Set(items.flatMap((item) =>
    item.source === 'evo_vault' && item.vault_product_id ? [item.vault_product_id] : []))]
  const activeVaultProductIds = new Set<string>()

  if (vaultProductIds.length > 0) {
    const now = new Date().toISOString()
    const accessResult = await supabase.from('digital_access').select(ACCESS_COLUMNS)
      .in('vault_product_id', vaultProductIds).eq('source', 'evo_vault')
      .eq('status', 'active').is('revoked_at', null)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
    if (accessResult.error) return { data: null, error: accessResult.error }
    for (const access of accessResult.data ?? []) {
      if (typeof access.vault_product_id === 'string') activeVaultProductIds.add(access.vault_product_id)
    }
  }

  return { data: {
    ...(orderResult.data as Omit<CustomerOrderDetail, 'items' | 'payments' | 'activeVaultProductIds'>),
    items,
    payments: (paymentsResult.data ?? []) as CustomerPayment[],
    activeVaultProductIds,
  }, error: null }
}
