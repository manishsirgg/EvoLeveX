type DiagnosticError = {
  code?: unknown
  message?: unknown
  details?: unknown
  hint?: unknown
}

export type VaultBookAssetDiagnostic = {
  operation: string
  stage: string
  productId: string
  assetId?: string | null
  error?: DiagnosticError | null
}

const MAX_FIELD_LENGTH = 500

/** Keep provider diagnostics useful without allowing credentials or private object locations into logs. */
export function safeVaultDiagnosticField(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null

  return value
    .replace(/https?:\/\/\S+/gi, '[REDACTED_URL]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[REDACTED_TOKEN]')
    .replace(/\b(?:access|refresh|session|authorization|api[_-]?key|service[_-]?role)[_-]?(?:token|key)?\s*[:=]\s*[^\s,;]+/gi, '[REDACTED_SECRET]')
    .replace(/\bvault\/[0-9a-f-]{36}\/books\/[^\s,;"']+/gi, '[REDACTED_STORAGE_PATH]')
    .replace(/\b(?:file_path|storage_path)\s*[:=]\s*["']?[^\s,;"']+/gi, '[REDACTED_STORAGE_PATH]')
    .slice(0, MAX_FIELD_LENGTH)
}

export function logVaultBookAssetFailure({ operation, stage, productId, assetId = null, error }: VaultBookAssetDiagnostic) {
  console.error('Vault book asset operation failed', {
    operation,
    stage,
    code: safeVaultDiagnosticField(error?.code),
    message: safeVaultDiagnosticField(error?.message),
    details: safeVaultDiagnosticField(error?.details),
    hint: safeVaultDiagnosticField(error?.hint),
    productId,
    assetId,
  })
}
