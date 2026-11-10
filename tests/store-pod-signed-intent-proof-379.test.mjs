import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
import {digestPodQuoteIntent,signPodQuoteIntent,verifyPodQuoteIntent}
 from '../src/lib/printful/pod-signed-intent-proof.ts'

const {privateKey,publicKey}=generateKeyPairSync('ed25519')
const now=Date.parse('2026-11-10T15:00:00.000Z')
const customerId='a1000000-0000-4000-8000-000000000001'
const idempotencyKey='a1000000-0000-4000-8000-000000000002'
const workerId='a1000000-0000-4000-8000-000000000003'
const nonce='abcdef0123456789abcdef0123456789'
const quote={
 customerId,idempotencyKey,
 printfulStoreId:'a1000000-0000-4000-8000-000000000004',
 currency:'USD',destinationCountry:'US',destinationDigest:'a'.repeat(64),
 subtotal:'60.00',shippingTotal:'7.50',taxTotal:'2.10',
 providerShippingOption:'STANDARD',
 providerQuoteObservedAt:new Date(now-1000).toISOString(),
 expiresAt:new Date(now+5*60_000).toISOString(),
 lines:[
  {productMapId:'a1000000-0000-4000-8000-000000000005',
   productId:'a1000000-0000-4000-8000-000000000006',
   variantId:'a1000000-0000-4000-8000-000000000007',
   syncVariantId:'123456',catalogVariantId:'56789',sku:'EVO-BLK-S',
   quantity:2,unitPrice:'30.00'},
 ],
}
const claims={
 v:1,iss:'evo-store-isolated-quote-preparer',
 aud:'evo-store-pod-quote-intent-staging-v1',
 workerId,customerId,idempotencyKey,nonce,
 quoteDigest:digestPodQuoteIntent(quote),iat:now,exp:now+60_000,
}

test('valid Ed25519 proof binds exact customer, nonce and full quote',()=>{
 const proof=signPodQuoteIntent(claims,quote,privateKey,now)
 assert.deepEqual(verifyPodQuoteIntent(proof,quote,workerId,nonce,publicKey,now),claims)
})
test('tampering with any material quote field is rejected',()=>{
 const proof=signPodQuoteIntent(claims,quote,privateKey,now)
 for(const changed of [
  {...quote,shippingTotal:'8.50'},
  {...quote,taxTotal:'0.00'},
  {...quote,destinationDigest:'b'.repeat(64)},
  {...quote,providerShippingOption:'EXPRESS'},
  {...quote,lines:[{...quote.lines[0],catalogVariantId:'99999'}]},
  {...quote,lines:[{...quote.lines[0],quantity:1}]},
  {...quote,lines:[{...quote.lines[0],sku:'EVO-BLK-M'}]},
  {...quote,lines:[{...quote.lines[0],unitPrice:'31.00'}]},
  {...quote,printfulStoreId:'a1000000-0000-4000-8000-000000000099'},
  {...quote,expiresAt:new Date(now+6*60_000).toISOString()},
 ])assert.throws(()=>verifyPodQuoteIntent(proof,changed,workerId,nonce,publicKey,now),/STORE_POD_INTENT_/)
})
test('wrong signing key, nonce, worker identity or expiry is denied',()=>{
 const proof=signPodQuoteIntent(claims,quote,privateKey,now)
 const other=generateKeyPairSync('ed25519')
 assert.throws(()=>verifyPodQuoteIntent(proof,quote,workerId,nonce,other.publicKey,now),/SIGNATURE_INVALID/)
 assert.throws(()=>verifyPodQuoteIntent(proof,quote,workerId,'1'.repeat(32),publicKey,now),/BINDING_INVALID/)
 assert.throws(()=>verifyPodQuoteIntent(proof,quote,customerId,nonce,publicKey,now),/BINDING_INVALID/)
 assert.throws(()=>verifyPodQuoteIntent(proof,quote,workerId,nonce,publicKey,now+60_000),/BINDING_INVALID/)
 assert.throws(()=>signPodQuoteIntent({...claims,quoteDigest:'0'.repeat(64)},quote,privateKey,now),/CLAIMS_INVALID/)
})
test('same quote lines in different order retain stable intent digest',()=>{
 const second={...quote.lines[0],
  variantId:'a1000000-0000-4000-8000-000000000008',
  sku:'EVO-WHT-S',quantity:1,unitPrice:'20.00'}
 const first={...quote.lines[0],quantity:1,unitPrice:'40.00'}
 const left={...quote,lines:[first,second]}
 assert.equal(digestPodQuoteIntent(left),digestPodQuoteIntent({...left,lines:[second,first]}))
})
