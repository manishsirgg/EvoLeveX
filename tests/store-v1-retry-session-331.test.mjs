import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
test('Store checkout retry keys persist in tab storage and reject malformed stored keys',async()=>{
 const helper=await read('src/lib/store-checkout-attempt-key.ts')
 const review=await read('src/components/store/store-checkout-review.tsx')
 assert.ok(helper.includes('sessionStorage.getItem(storageKey)'))
 assert.ok(helper.includes('sessionStorage.setItem(storageKey'))
 assert.ok(helper.includes('value.fingerprint===fingerprint'))
 assert.ok(helper.includes('UUID.test(value.key)'))
 assert.ok(helper.includes("kind:'reservation'|'intent'"))
 assert.ok(review.includes("getStoreCheckoutAttemptKey('reservation',fingerprint)"))
 assert.ok(review.includes("getStoreCheckoutAttemptKey('intent',finalOrder.order_id)"))
 assert.doesNotMatch(review,/key:crypto\.randomUUID\(\)/)
})
