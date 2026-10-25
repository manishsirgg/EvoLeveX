import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('Store admin offers the next catalog action based on real published counts',async()=>{
 const page=await readFile(new URL('../src/app/admin/store/page.tsx',import.meta.url),'utf8')
 for(const expected of ['await requireAdmin()','getStoreAdminOverview()','overview.published === 0','overview.products > 0','/admin/store/products/new','/admin/store/products','/store','Catalog status could not be verified','does not enable Razorpay payments or Printful fulfilment'])
  assert.ok(page.includes(expected),expected)
 assert.ok(page.indexOf('await requireAdmin()')<page.indexOf('getStoreAdminOverview()'))
})
