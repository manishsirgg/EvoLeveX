'use server'

import { requireAdmin } from '@/lib/admin-auth'
import { probePrintfulConnection } from '@/lib/printful/read-only'

export async function checkPrintfulConnection() {
  await requireAdmin()
  return probePrintfulConnection()
}

import { getPrintfulProductDetail } from '@/lib/printful/product-detail'

export async function previewPrintfulProduct(id: number) {
  await requireAdmin()
  return getPrintfulProductDetail(id)
}
