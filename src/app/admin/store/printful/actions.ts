'use server'

import { requireAdmin } from '@/lib/admin-auth'
import { probePrintfulConnection } from '@/lib/printful/read-only'

export async function checkPrintfulConnection() {
  await requireAdmin()
  return probePrintfulConnection()
}
