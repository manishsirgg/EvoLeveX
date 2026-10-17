import {createHash, sign, verify, type KeyObject} from 'node:crypto'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NONCE=/^[0-9a-f]{32,64}$/
const ORDER=/^order_[A-Za-z0-9]{8,64}$/
const MAX_AGE_MS=60_000
const AUDIENCE='evo-store-correlation-worker-staging-v1'
export type StoreCorrelationProofClaims=Readonly<{
 v:1;iss:'evo-store-isolated-worker';aud:typeof AUDIENCE;
 operatorId:string;attemptId:string;nonce:string;
 providerOrderId:string;evidenceDigest:string;
 iat:number;exp:number
}>
export type SignedStoreCorrelationProof=Readonly<{payload:string;signature:string}>
export function digestStoreCorrelationEvidence(input:Readonly<{
 receipt:string;amount:string;currency:string;providerOrderId:string
}>):string{
 // Canonical length-prefixed fields, no concatenation ambiguity.
 const fields=[input.receipt,input.amount,input.currency,input.providerOrderId]
 return createHash('sha256').update(fields.map(x=>`${Buffer.byteLength(x,'utf8')}:${x}`).join('|')).digest('hex')
}
function valid(c:StoreCorrelationProofClaims,now:number):boolean{
 return c.v===1&&c.iss==='evo-store-isolated-worker'&&c.aud===AUDIENCE
  &&UUID.test(c.operatorId)&&UUID.test(c.attemptId)&&NONCE.test(c.nonce)
  &&ORDER.test(c.providerOrderId)&&/^[0-9a-f]{64}$/.test(c.evidenceDigest)
  &&Number.isSafeInteger(c.iat)&&Number.isSafeInteger(c.exp)
  &&c.iat<=now&&c.exp>now&&c.exp>c.iat&&c.exp-c.iat<=MAX_AGE_MS
}
export function signStoreCorrelationProof(
 claims:StoreCorrelationProofClaims,privateKey:KeyObject,now=Date.now(),
):SignedStoreCorrelationProof{
 if(privateKey.asymmetricKeyType!=='ed25519'||!valid(claims,now))
  throw new Error('STORE_PROOF_CLAIMS_INVALID')
 const payload=Buffer.from(JSON.stringify(claims)).toString('base64url')
 const signature=sign(null,Buffer.from(payload,'ascii'),privateKey).toString('base64url')
 return {payload,signature}
}
export function verifyStoreCorrelationProof(
 proof:SignedStoreCorrelationProof,publicKey:KeyObject,now=Date.now(),
):StoreCorrelationProofClaims{
 if(publicKey.asymmetricKeyType!=='ed25519'
  ||!proof||typeof proof.payload!=='string'||typeof proof.signature!=='string'
  ||proof.payload.length>4096||proof.signature.length>256
  ||!/^[A-Za-z0-9_-]+$/.test(proof.payload)||!/^[A-Za-z0-9_-]+$/.test(proof.signature))
  throw new Error('STORE_PROOF_INVALID')
 const signature=Buffer.from(proof.signature,'base64url')
 if(signature.length!==64
  ||!verify(null,Buffer.from(proof.payload,'ascii'),publicKey,signature))
  throw new Error('STORE_PROOF_SIGNATURE_INVALID')
 let parsed:StoreCorrelationProofClaims
 try{parsed=JSON.parse(Buffer.from(proof.payload,'base64url').toString('utf8'))}catch{
  throw new Error('STORE_PROOF_PAYLOAD_INVALID')
 }
 if(!parsed||typeof parsed!=='object'||!valid(parsed,now))
  throw new Error('STORE_PROOF_CLAIMS_INVALID')
 return parsed
}
