import {createHash,sign,verify,timingSafeEqual,type KeyObject} from 'node:crypto'
import {validateTrustedPodQuoteEvidence,type TrustedPodQuoteEvidence}
 from './pod-restricted-quote-contract.ts'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NONCE=/^[a-f0-9]{32,64}$/
const HASH=/^[a-f0-9]{64}$/
const AUDIENCE='evo-store-pod-quote-intent-staging-v1'
const MAX_AGE_MS=60_000

export type PodQuoteIntentClaims=Readonly<{
 v:1;iss:'evo-store-isolated-quote-preparer';aud:typeof AUDIENCE
 workerId:string;customerId:string;idempotencyKey:string
 nonce:string;quoteDigest:string;iat:number;exp:number
}>
export type SignedPodQuoteIntent=Readonly<{payload:string;signature:string}>

/** Canonical fingerprint of FULL trusted quote evidence (including every
 * variant mapping, retail amount, tax and selected shipping option).
 * A digest alone is not authorization or authenticated source evidence.
 */
export function digestPodQuoteIntent(evidence:TrustedPodQuoteEvidence):string{
 const lines=[...evidence.lines].map(line=>({
  productMapId:line.productMapId.toLowerCase(),
  productId:line.productId.toLowerCase(),
  variantId:line.variantId.toLowerCase(),
  syncVariantId:line.syncVariantId,
  catalogVariantId:line.catalogVariantId,
  sku:line.sku,quantity:line.quantity,unitPrice:line.unitPrice,
 })).sort((a,b)=>a.variantId.localeCompare(b.variantId))
 return createHash('sha256').update(JSON.stringify({
  version:1,customerId:evidence.customerId.toLowerCase(),
  idempotencyKey:evidence.idempotencyKey.toLowerCase(),
  printfulStoreId:evidence.printfulStoreId.toLowerCase(),
  currency:evidence.currency,destinationCountry:evidence.destinationCountry,
  destinationDigest:evidence.destinationDigest,
  subtotal:evidence.subtotal,shippingTotal:evidence.shippingTotal,
  taxTotal:evidence.taxTotal,
  providerShippingOption:evidence.providerShippingOption,
  providerQuoteObservedAt:new Date(evidence.providerQuoteObservedAt).toISOString(),
  expiresAt:new Date(evidence.expiresAt).toISOString(),lines,
 })).digest('hex')
}
function validClaims(c:PodQuoteIntentClaims,now:number):boolean{
 return !!c&&Number.isSafeInteger(now)
  &&c.v===1&&c.iss==='evo-store-isolated-quote-preparer'&&c.aud===AUDIENCE
  &&UUID.test(c.workerId)&&UUID.test(c.customerId)&&UUID.test(c.idempotencyKey)
  &&NONCE.test(c.nonce)&&HASH.test(c.quoteDigest)
  &&Number.isSafeInteger(c.iat)&&Number.isSafeInteger(c.exp)
  &&c.iat<=now&&c.exp>now&&c.exp>c.iat
  &&c.exp-c.iat<=MAX_AGE_MS
}

/** Sign only with an independently owned isolated-worker Ed25519 key.
 * Never sign data supplied directly by a browser or a provider webhook.
 */
export function signPodQuoteIntent(
 claims:PodQuoteIntentClaims,evidence:TrustedPodQuoteEvidence,
 privateKey:KeyObject,now=Date.now(),
):SignedPodQuoteIntent{
 if(privateKey.asymmetricKeyType!=='ed25519'
  ||!validClaims(claims,now)
  ||!validateTrustedPodQuoteEvidence(evidence,now).ok
  ||claims.customerId.toLowerCase()!==evidence.customerId.toLowerCase()
  ||claims.idempotencyKey.toLowerCase()!==evidence.idempotencyKey.toLowerCase()
  ||claims.quoteDigest!==digestPodQuoteIntent(evidence))
  throw new Error('STORE_POD_INTENT_CLAIMS_INVALID')
 const payload=Buffer.from(JSON.stringify(claims)).toString('base64url')
 const signature=sign(null,Buffer.from(payload,'ascii'),privateKey).toString('base64url')
 return {payload,signature}
}

/** Authenticate a quote-preparer's signature and bind every evidence field.
 * This does NOT consume a nonce, grant database permissions, verify tax law,
 * certify Printful availability, or authorize payment or fulfilment.
 */
export function verifyPodQuoteIntent(
 proof:SignedPodQuoteIntent,evidence:TrustedPodQuoteEvidence,
 expectedWorkerId:string,expectedNonce:string,publicKey:KeyObject,
 now=Date.now(),
):PodQuoteIntentClaims{
 if(publicKey.asymmetricKeyType!=='ed25519'||!UUID.test(expectedWorkerId)
  ||!NONCE.test(expectedNonce)||!proof
  ||typeof proof.payload!=='string'||typeof proof.signature!=='string'
  ||proof.payload.length>4096||proof.signature.length>256
  ||!/^[A-Za-z0-9_-]+$/.test(proof.payload)
  ||!/^[A-Za-z0-9_-]+$/.test(proof.signature))
  throw new Error('STORE_POD_INTENT_PROOF_INVALID')
 const signature=Buffer.from(proof.signature,'base64url')
 if(signature.length!==64
  ||!verify(null,Buffer.from(proof.payload,'ascii'),publicKey,signature))
  throw new Error('STORE_POD_INTENT_SIGNATURE_INVALID')
 let claims:PodQuoteIntentClaims
 try{claims=JSON.parse(Buffer.from(proof.payload,'base64url').toString('utf8'))}
 catch{throw new Error('STORE_POD_INTENT_PAYLOAD_INVALID')}
 if(!validClaims(claims,now)
  ||!validateTrustedPodQuoteEvidence(evidence,now).ok
  ||claims.workerId.toLowerCase()!==expectedWorkerId.toLowerCase()
  ||claims.nonce!==expectedNonce
  ||claims.customerId.toLowerCase()!==evidence.customerId.toLowerCase()
  ||claims.idempotencyKey.toLowerCase()!==evidence.idempotencyKey.toLowerCase())
  throw new Error('STORE_POD_INTENT_BINDING_INVALID')
 const expected=Buffer.from(digestPodQuoteIntent(evidence),'hex')
 const actual=Buffer.from(claims.quoteDigest,'hex')
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))
  throw new Error('STORE_POD_INTENT_EVIDENCE_MISMATCH')
 return claims
}
