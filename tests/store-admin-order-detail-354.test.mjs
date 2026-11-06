import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('Store order details are staff guarded, scoped to existing Store items and read-only',async()=>{
 const page=await readFile(new URL('../src/app/admin/store/orders/[id]/page.tsx',import.meta.url),'utf8')
 const query=await readFile(new URL('../src/lib/admin-store-order-detail.ts',import.meta.url),'utf8')
 const listing=await readFile(new URL('../src/app/admin/store/orders/page.tsx',import.meta.url),'utf8')
 assert.ok(page.indexOf('await requireAdmin()')<page.indexOf('await getAdminStoreOrderDetail(id)'))
 assert.ok(query.includes('if(!isUuid(id))'))
 assert.ok(query.includes(".from('order_items')"))
 assert.ok(query.includes(".eq('source','store').limit(1)"))
 assert.ok(query.indexOf("if(!match?.length)")<query.indexOf("db.from('orders')"))
 assert.ok(query.includes("db.from('orders')"))
 assert.ok(query.includes("db.from('order_items').select('id,source"))
 assert.ok(query.includes('createClient()'))
 assert.doesNotMatch(query,/\.insert\(|\.update\(|\.delete\(|\.rpc\(|getServiceRoleClient/)
 assert.ok(listing.includes('href={`/admin/store/orders/${order.id}`}'))
 assert.ok(page.includes('notFound()'))
 assert.ok(page.includes('Delivery details'))
 assert.ok(page.includes('Payment status'))
})
