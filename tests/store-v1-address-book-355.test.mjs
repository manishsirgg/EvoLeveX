import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
test('address book uses authenticated and owner-scoped RLS reads and writes',async()=>{
 const actions=await read('src/app/account/addresses/actions.ts')
 const page=await read('src/app/account/addresses/page.tsx')
 const checkout=await read('src/components/store/store-checkout-review.tsx')
 const nav=await read('src/app/account/account-nav.tsx')
 for(const marker of ["db.auth.getUser()","user_id:user.id","is_default:false","revalidatePath('/store/checkout')",".eq('user_id',user.id)"])
  assert.ok(actions.includes(marker)||page.includes(marker),marker)
 assert.ok(page.includes("redirect('/auth/login')"))
 assert.ok(page.includes('AddAddressForm'))
 assert.ok(nav.includes("'/account/addresses'"))
 assert.ok(checkout.includes('href="/account/addresses"'))
 const originalCreateAndDelete = actions.slice(0, actions.indexOf('/** Edit only the requested address'))
 assert.ok(originalCreateAndDelete.length > 0)
 assert.doesNotMatch(originalCreateAndDelete,/service_role|createAdminClient|\.rpc\(/)
 // Newer actions may use narrowly authorized RPCs; those have dedicated tests.
 assert.doesNotMatch(actions,/service_role|createAdminClient/)
})
