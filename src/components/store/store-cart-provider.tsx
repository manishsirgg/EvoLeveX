'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import {
  isStoreVariantId, parseStoreCartPayload, serializeStoreCart, STORE_CART_MAX_LINES, STORE_CART_MAX_QUANTITY,
  STORE_CART_STORAGE_KEY, type StoreCartItem,
} from '@/lib/store-cart'

export type StoreCartMutationResult = 'added' | 'updated' | 'removed' | 'cleared' | 'quantity_limit' | 'line_limit' | 'invalid'
type StoreCartContextValue = {
  items: StoreCartItem[]
  itemCount: number
  lineCount: number
  isHydrated: boolean
  storageError: string | null
  addItem: (variantId: string, quantity?: number) => StoreCartMutationResult
  setQuantity: (variantId: string, quantity: number) => StoreCartMutationResult
  removeItem: (variantId: string) => StoreCartMutationResult
  clearCart: () => StoreCartMutationResult
}

const StoreCartContext = createContext<StoreCartContextValue | null>(null)

export function StoreCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<StoreCartItem[]>([])
  const itemsRef = useRef<StoreCartItem[]>([])
  const [isHydrated, setIsHydrated] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)

  const persist = useCallback((next: StoreCartItem[]) => {
    const serialized = serializeStoreCart(next)
    if (!serialized) return false
    try {
      localStorage.setItem(STORE_CART_STORAGE_KEY, serialized)
      setStorageError(null)
      return true
    } catch {
      setStorageError('Cart changes are available in this tab but could not be saved.')
      return false
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      let normalized: StoreCartItem[] = []
      try {
        const stored = localStorage.getItem(STORE_CART_STORAGE_KEY)
        const parsed = parseStoreCartPayload(stored)
        normalized = parsed?.items ?? []
        if (parsed) persist(normalized)
      } catch {
        setStorageError('Your saved cart could not be read. You can still start a new cart.')
      }
      setItems(normalized)
      itemsRef.current = normalized
      setIsHydrated(true)
    })
  }, [persist])

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key !== STORE_CART_STORAGE_KEY) return
      const parsed = parseStoreCartPayload(event.newValue)
      const next = parsed?.items ?? []
      itemsRef.current = next
      setItems(next)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const addItem = useCallback((variantId: string, quantity = 1): StoreCartMutationResult => {
    if (!isStoreVariantId(variantId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > STORE_CART_MAX_QUANTITY) return 'invalid'
    const current = itemsRef.current
    const index = current.findIndex((item) => item.variant_id === variantId)
    if (index < 0 && current.length >= STORE_CART_MAX_LINES) return 'line_limit'
    const total = index < 0 ? quantity : current[index].quantity + quantity
    const result: StoreCartMutationResult = total > STORE_CART_MAX_QUANTITY ? 'quantity_limit' : 'added'
    const next = index < 0 ? [...current, { variant_id: variantId, quantity }]
      : current.map((item, position) => position === index
        ? { ...item, quantity: Math.min(STORE_CART_MAX_QUANTITY, total) } : item)
    itemsRef.current = next
    setItems(next)
    persist(next)
    return result
  }, [persist])

  const setQuantity = useCallback((variantId: string, quantity: number): StoreCartMutationResult => {
    if (!isStoreVariantId(variantId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > STORE_CART_MAX_QUANTITY) return 'invalid'
    const next = itemsRef.current.map((item) => item.variant_id === variantId ? { ...item, quantity } : item)
    itemsRef.current = next; setItems(next); persist(next)
    return 'updated'
  }, [persist])

  const removeItem = useCallback((variantId: string): StoreCartMutationResult => {
    const next = itemsRef.current.filter((item) => item.variant_id !== variantId)
    itemsRef.current = next; setItems(next); persist(next)
    return 'removed'
  }, [persist])

  const clearCart = useCallback((): StoreCartMutationResult => {
    itemsRef.current = []; setItems([]); persist([]); return 'cleared'
  }, [persist])

  const value = useMemo(() => ({ items, lineCount: items.length,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0), isHydrated, storageError,
    addItem, setQuantity, removeItem, clearCart,
  }), [items, isHydrated, storageError, addItem, setQuantity, removeItem, clearCart])
  return <StoreCartContext.Provider value={value}>{children}</StoreCartContext.Provider>
}

export function useStoreCart() {
  const context = useContext(StoreCartContext)
  if (!context) throw new Error('useStoreCart must be used within StoreCartProvider')
  return context
}
