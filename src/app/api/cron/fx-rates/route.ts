import 'server-only'

import { timingSafeEqual } from 'node:crypto'

import { refreshUsdExchangeRates } from '@/lib/fx/rates'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!secret || !authorization?.startsWith('Bearer ')) return false
  const supplied = Buffer.from(authorization.slice(7))
  const expected = Buffer.from(secret)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    return Response.json(await refreshUsdExchangeRates())
  } catch (error) {
    console.error('FX rate refresh failed', error)
    return Response.json({ ok: false, error: 'FX rate refresh failed' }, { status: 503 })
  }
}
