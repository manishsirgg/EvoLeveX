import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('Store admin order list requires staff and presents read-only order statuses',async()=>{
 const page=await readFile(new URL('../src/app/admin/store/orders/page.tsx',import.meta.url),'utf8')
 const query=await readFile(new URL('../src/lib/admin-store-orders.ts',import.meta.url),'utf8')
 const dashboard=await readFile(new URL('../src/app/admin/store/page.tsx',import.meta.url),'utf8')
 assert.ok(page.indexOf('await requireAdmin()')<page.indexOf('await getAdminStoreOrders()'))
 assert.match(query,/\.from\('orders'\)/)
 assert.match(query,/order_items!inner\(source\)/)
 assert.match(query,/\.eq\('order_items.source','store'\)/)
 assert.match(query,/\.limit\(50\)/)
 assert.ok(query.includes('createClient()'))
 assert.doesNotMatch(query,/service_role|\.insert\(|\.update\(|\.delete\(|\.rpc\(/)
 assert.ok(dashboard.includes("href: '/admin/store/orders'"))
 assert.ok(page.includes('orders.length===0'))
})
