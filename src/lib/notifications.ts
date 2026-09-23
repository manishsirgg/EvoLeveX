export function isSafeInternalPath(value: string | null): value is string {
  if (!value?.startsWith('/') || value.startsWith('//')) return false
  try {
    return new URL(value, 'https://evolevex.internal').origin === 'https://evolevex.internal'
  } catch {
    return false
  }
}
