import { isIP } from 'node:net'

export const LOCAL_DATABASE = Object.freeze({
  protocol: 'postgresql:',
  hostname: '127.0.0.1',
  port: '55432',
  database: 'postgres',
  username: 'postgres',
  password: 'postgres',
  projectId: 'evolevex-p1-003',
})

export const LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:55432/postgres'

const cloudHostname = /(?:^|\.)(?:supabase\.(?:co|net)|pooler\.supabase\.com)$/i

export function validateDisposableTarget(candidate, projectId) {
  if (candidate !== LOCAL_DATABASE_URL) throw new Error('Refusing non-canonical database target')
  if (projectId !== LOCAL_DATABASE.projectId) throw new Error('Refusing unexpected Supabase project identity')

  const url = new URL(candidate)
  if (url.protocol !== LOCAL_DATABASE.protocol) throw new Error('Refusing non-PostgreSQL target')
  if (cloudHostname.test(url.hostname) || url.hostname.includes('supabase')) {
    throw new Error('Refusing Supabase Cloud target')
  }
  if (url.hostname !== LOCAL_DATABASE.hostname || isIP(url.hostname) !== 4) {
    throw new Error('Refusing non-loopback target')
  }
  for (const key of ['port', 'database', 'username', 'password']) {
    if ((key === 'database' ? url.pathname.slice(1) : url[key]) !== LOCAL_DATABASE[key]) {
      throw new Error(`Refusing unexpected local database ${key}`)
    }
  }
  return Object.freeze({ url: candidate, projectId })
}
