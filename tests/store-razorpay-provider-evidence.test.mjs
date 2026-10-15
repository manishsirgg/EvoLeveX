import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyStoreProviderOrderEvidence } from '../src/lib/store-razorpay-provider-evidence.ts'

const expected={providerOrderId:'order_123456789',receipt:'evs_1234567890abcdef1234567890abcdef',amount:'29.00',currency:'USD'}
const valid={id:expected.providerOrderId,receipt:expected.receipt,amount:2900,currency:'USD'}
test('accepts exact provider order GET evidence without granting payment',()=>{
  assert.deepEqual(verifyStoreProviderOrderEvidence(expected,valid),{id:valid.id,receipt:valid.receipt,amount:2900,currency:'USD'})
})
test('rejects mismatched provider order, receipt, currency, amount, and malformed JSON',()=>{
  for(const mutation of [
    {id:'order_987654321'}, {receipt:'evs_ffffffffffffffffffffffffffffffff'},
    {amount:2901},{amount:'2900'},{currency:'JPY'},{id:null}
  ]) assert.throws(()=>verifyStoreProviderOrderEvidence(expected,{...valid,...mutation}),/MISMATCH/)
  for(const data of [null,[],42]) assert.throws(()=>verifyStoreProviderOrderEvidence(expected,data),/INVALID/)
})
test('JPY precision and account expectation validation fail closed',()=>{
  const jpy={...expected,amount:'120.00',currency:'JPY'}
  assert.equal(verifyStoreProviderOrderEvidence(jpy,{...valid,currency:'JPY',amount:120}).amount,120)
  assert.throws(()=>verifyStoreProviderOrderEvidence({...jpy,amount:'120.50'},{...valid,currency:'JPY',amount:120}),/integral/)
  assert.throws(()=>verifyStoreProviderOrderEvidence({...expected,receipt:'wrong'},valid),/INVALID/)
})
