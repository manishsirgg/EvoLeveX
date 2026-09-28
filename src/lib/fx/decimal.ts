const INTERNAL_SCALE = 18

function parseDecimal(value: string | number, scale: number): bigint {
  const source = String(value).trim()
  const match = /^(\d+)(?:\.(\d+))?$/.exec(source)
  if (!match) throw new Error('Money amount must be a non-negative decimal')
  const fraction = match[2] ?? ''
  if (fraction.length > scale) throw new Error(`Decimal has more than ${scale} fractional digits`)
  return BigInt(match[1]) * BigInt(10) ** BigInt(scale) + BigInt((fraction + '0'.repeat(scale)).slice(0, scale) || '0')
}

function formatMinorUnits(minor: bigint, decimals: number): string {
  if (decimals === 0) return minor.toString()
  const factor = BigInt(10) ** BigInt(decimals)
  return `${minor / factor}.${(minor % factor).toString().padStart(decimals, '0')}`
}

export function multiplyAndRoundDecimal(amount: string | number, rate: string | number, outputDecimals: number): string {
  if (!Number.isInteger(outputDecimals) || outputDecimals < 0 || outputDecimals > INTERNAL_SCALE) {
    throw new Error('Invalid output precision')
  }
  const product = parseDecimal(amount, INTERNAL_SCALE) * parseDecimal(rate, INTERNAL_SCALE)
  const divisor = BigInt(10) ** BigInt(INTERNAL_SCALE * 2 - outputDecimals)
  return formatMinorUnits((product + divisor / BigInt(2)) / divisor, outputDecimals)
}
