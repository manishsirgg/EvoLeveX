/** Browser-tab scoped retry keys for ambiguous Store checkout requests.
 * A browser refresh retains the same UUID for the same order/cart identity.
 * This stores NO credentials or payment data; failures fall back to memory only.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function getStoreCheckoutAttemptKey(kind:'reservation'|'intent',fingerprint:string):string{
 const storageKey='evo-store-v1-attempt-'+kind
 try{
  const previous=sessionStorage.getItem(storageKey)
  if(previous){
   const value:unknown=JSON.parse(previous)
   if(value&&typeof value==='object'&&!Array.isArray(value)
    &&'fingerprint' in value&&'key' in value
    &&value.fingerprint===fingerprint&&typeof value.key==='string'&&UUID.test(value.key))
    return value.key
  }
 }catch{/* Storage can be unavailable; continue with an in-memory retry key. */}
 const key=crypto.randomUUID()
 try{sessionStorage.setItem(storageKey,JSON.stringify({fingerprint,key}))}catch{}
 return key
}
