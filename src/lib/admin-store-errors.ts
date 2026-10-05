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

export function mapStoreProductImageDatabaseError(error: StoreDatabaseError | null | undefined): string {
  const code = typeof error?.code === 'string' ? error.code : ''
  const message = typeof error?.message === 'string' ? error.message : ''
  const known: Record<string, string> = {
    EVO_STORE_IMAGE_ARCHIVED_PRODUCT: 'Archived products are read-only. Images cannot be changed.',
    EVO_STORE_IMAGE_PRIMARY_UNAUTHORIZED: 'You are not authorized to change the primary image.',
    EVO_STORE_IMAGE_PRIMARY_PRODUCT_NOT_FOUND: 'This product could not be found.',
    EVO_STORE_IMAGE_PRIMARY_IMAGE_NOT_FOUND: 'That image does not belong to this product.',
    EVO_STORE_IMAGE_PRIMARY_INACTIVE: 'Activate the image before setting it as primary.',
    EVO_STORE_READY_IMAGE_REQUIRED: 'A published product must retain an active image.',
    EVO_STORE_READY_PRIMARY_IMAGE_REQUIRED: 'Set another active image as primary before deactivating this image.',
  }
  if ((code === 'P0001' || code === 'P0002') && known[message]) return known[message]
  if (code === '23505') return 'That image is already registered or conflicts with the current primary image. Refresh and try again.'
  if (code === '23514') return 'The image details do not meet the required file or path rules.'
  if (code === '42501') return 'You are not authorized to make that image change.'
  return mapStoreAdminDatabaseError(error)
}

export function mapStoreProductVariantDatabaseError(error: StoreDatabaseError | null | undefined): string {
  const code = typeof error?.code === 'string' ? error.code : ''
  const message = typeof error?.message === 'string' ? error.message : ''
  if (code === 'P0001' && message === 'EVO_STORE_VARIANT_ARCHIVED_PRODUCT') return 'Archived products are read-only. Variants cannot be changed.'
  if (code === 'P0001' && message.startsWith('EVO_STORE_READY_')) return getStoreReadinessMessage(message)
  if (code === '23505' && message.includes('sku')) return 'That SKU is already in use. Choose another SKU.'
  if (code === '23505' && message.includes('dimensions')) return 'This product already has a variant with that size and color.'
  if (code === '23514' && message.includes('weight')) return 'Weight must be a positive whole number of grams, or left blank while the variant is inactive.'
  if (code === '23514') return 'The SKU, size, color, weight, or sort order is invalid.'
  if (code === '42501') return 'You are not authorized to make that variant change.'
  return mapStoreAdminDatabaseError(error)
}

export function mapStoreVariantPriceDatabaseError(error: StoreDatabaseError | null | undefined): string {
  const code = typeof error?.code === 'string' ? error.code : ''
  const message = typeof error?.message === 'string' ? error.message : ''
  const known: Record<string, string> = {
    EVO_STORE_VARIANT_PRICE_ARCHIVED_PRODUCT: 'Archived products are read-only. Prices cannot be changed.',
    EVO_STORE_READY_VARIANT_PRICE_REQUIRED: 'This price cannot be changed because each active variant on a published product must retain at least one active price greater than zero.',
  }
  if (code === 'P0001' && known[message]) return known[message]
  if (code === 'P0001' && message.startsWith('EVO_STORE_READY_')) return getStoreReadinessMessage(message)
  if (code === '23505') return 'This variant already has a price for that currency.'
  if (code === '23514' && message.includes('currency')) return 'Select a supported currency.'
  if (code === '23514' && message.includes('jpy')) return 'JPY prices must use whole yen.'
  if (code === '23514' && message.includes('amount')) return 'Enter a valid price amount.'
  if (code === '22003') return 'The price amount is too large.'
  if (code === '42501') return 'You are not authorized to make that price change.'
  return 'The price change could not be completed. Please try again.'
}

export function mapStoreVariantInventoryDatabaseError(error: StoreDatabaseError | null | undefined): string {
  const code = typeof error?.code === 'string' ? error.code : ''
  const message = typeof error?.message === 'string' ? error.message : ''
  if (code === 'P0001' && message === 'EVO_STORE_INVENTORY_ARCHIVED_PRODUCT') return 'Archived products are read-only. Inventory cannot be changed.'
  if (code === '42501') return 'You are not authorized to change inventory.'
  if (code === '23503' || message === 'inventory variant does not exist') return 'This variant could not be found.'
  if (code === '23505') return 'Inventory was already initialized for this variant. Refresh to see the current stock.'
  if (code === 'P0002' || message === 'inventory row does not exist') return 'Inventory has not been initialized for this variant.'
  if (code === '22003') return 'The inventory quantity is outside the supported range.'
  if (message === 'resulting stock cannot be negative') return 'There is not enough on-hand stock for that removal.'
  if (message === 'resulting stock cannot be below reserved stock') return 'On-hand stock cannot be reduced below reserved stock.'
  if (message === 'set quantity must change stock') return 'The new on-hand quantity is unchanged.'
  if (code === '22023' || code === '22004') return 'The inventory quantity, operation, or reason is invalid.'
  return 'The inventory change could not be completed. Refresh and try again.'
}
