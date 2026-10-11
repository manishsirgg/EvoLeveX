import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('landed-cost worksheet is offline with required explicit costs and currency verification', async () => {
  const calculator = await readFile(new URL('../src/lib/printful/landed-cost-worksheet.ts', import.meta.url), 'utf8')
  const ui = await readFile(new URL('../src/app/admin/store/printful/landed-cost-worksheet-control.tsx', import.meta.url), 'utf8')
  const page = await readFile(new URL('../src/app/admin/store/printful/page.tsx', import.meta.url), 'utf8')
  assert.match(calculator, /CURRENCY_NOT_VERIFIED/)
  assert.match(calculator, /MISSING_OR_INVALID_INPUT/)
  assert.match(calculator, /printingExtra/)
  assert.match(calculator, /taxesAndDuties/)
  assert.match(calculator, /paymentFees/)
  assert.match(ui, /currencyConfirmed && acknowledged/)
  assert.match(ui, /All fields are required/)
  assert.doesNotMatch(calculator + ui, /\bfetch\s*\(|process\.env|\.rpc\(|\.insert\(|\.update\(|\.upsert\(/)
  assert.match(page, /await requireAdmin\(\)/)
  assert.match(page, /<LandedCostWorksheetControl \/>/)
})
