import test from 'node:test'
import assert from 'node:assert/strict'
import {identifyUniqueStoreProviderOrder} from '../src/lib/store-razorpay-uncertain-discovery.ts'

const receipt='evs_1234567890abcdef1234567890abcdef'
const expected={receipt,amount:'29.00',currency:'USD'}
const order=(id='order_12345678',amount=2900)=>({id,receipt,amount,currency:'USD'})
const page=(...items)=>({entity:'collection',count:items.length,items})

test('uniquely identifies exact matching Razorpay order evidence',()=>{
  assert.deepEqual(identifyUniqueStoreProviderOrder(expected,[page(order())]),order())
})
test('fails closed on empty, ambiguous, mismatch and malformed discovery',()=>{
  assert.throws(()=>identifyUniqueStoreProviderOrder(expected,[page()]),/NOT_FOUND/)
  assert.throws(()=>identifyUniqueStoreProviderOrder(expected,[page(order(),order('order_87654321'))]),/AMBIGUOUS/)
  assert.throws(()=>identifyUniqueStoreProviderOrder(expected,[page(order('order_12345678',2901))]),/MISMATCH/)
  assert.throws(()=>identifyUniqueStoreProviderOrder(expected,[{entity:'collection',count:2,items:[order()]}]),/INVALID/)
  assert.throws(()=>identifyUniqueStoreProviderOrder(expected,[]),/INCOMPLETE/)
  assert.throws(()=>identifyUniqueStoreProviderOrder(expected,Array.from({length:11},()=>page())),/INCOMPLETE/)
})
test('same provider id repeated on pages is not ambiguous, unknown receipts ignored',()=>{
  const other={...order('order_98765432'),receipt:'another_receipt'}
  assert.equal(identifyUniqueStoreProviderOrder(expected,[page(other,order()),page(order())]).id,'order_12345678')
})
