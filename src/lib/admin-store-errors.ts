export type StoreDatabaseError = {
  code?: unknown
  message?: unknown
}

const READINESS_MESSAGES: Record<string, string> = {
  EVO_STORE_READY_PRODUCT_NOT_FOUND: 'The product could not be found.',
  EVO_STORE_READY_PHYSICAL_REQUIRED: 'Store products must be physical before publication.',
  EVO_STORE_READY_ACTIVE_CATEGORY_REQUIRED: 'Select an active category before publishing.',
  EVO_STORE_READY_IMAGE_REQUIRED: 'Add an active product image before publishing.',
  EVO_STORE_READY_PRIMARY_IMAGE_REQUIRED: 'Select exactly one primary image before publishing.',
  EVO_STORE_READY_ACTIVE_VARIANT_REQUIRED: 'Add an active variant before publishing.',
  EVO_STORE_READY_VARIANT_WEIGHT_REQUIRED: 'Every active variant needs a positive weight before publishing.',
  EVO_STORE_READY_VARIANT_INVENTORY_REQUIRED: 'Initialize inventory for every active variant before publishing.',
  EVO_STORE_READY_VARIANT_PRICE_REQUIRED: 'Add an active price for every active variant before publishing.',
}

export function getStoreReadinessMessage(code: string): string {
  return READINESS_MESSAGES[code] ?? 'This product does not meet a publication requirement.'
}

export function mapStoreAdminDatabaseError(error: StoreDatabaseError | null | undefined): string {
  const code = typeof error?.code === 'string' ? error.code : ''
  const message = typeof error?.message === 'string' ? error.message : ''

  if (code === '23505') return 'A Store record with those unique details already exists.'
  if (code === '23503') return 'That Store record is linked to missing or dependent data.'
  if (code === '23514') return 'The Store data does not meet the required rules.'
  if (code === '42501') return 'You are not authorized to make that Store change.'
  if (code === 'P0002') return 'Inventory has not been initialized for this variant.'
  if (code === '22023' || code === '22004') return 'The inventory input is invalid.'
  if (code === 'P0001' && message.startsWith('EVO_STORE_READY_')) {
    return READINESS_MESSAGES[message] ?? 'The product is not ready to publish.'
  }
  return 'The Store change could not be completed. Please try again.'
}

export function mapStoreCategoryDatabaseError(error: StoreDatabaseError | null | undefined): string {
  const code = typeof error?.code === 'string' ? error.code : ''
  const message = typeof error?.message === 'string' ? error.message : ''

  if (code === '23505') return 'That category slug is already in use. Choose another slug.'
  if (code === 'P0001' && message === 'EVO_STORE_READY_ACTIVE_CATEGORY_REQUIRED') {
    return 'This category cannot be deactivated while published products depend on it.'
  }
  return mapStoreAdminDatabaseError(error)
}

export function mapStoreProductDatabaseError(error: StoreDatabaseError | null | undefined): string {
  const code = typeof error?.code === 'string' ? error.code : ''
  if (code === '23505') return 'That product slug is already in use. Choose another slug.'
  if (code === '23503') return 'The selected category is no longer available.'
  return mapStoreAdminDatabaseError(error)
}
