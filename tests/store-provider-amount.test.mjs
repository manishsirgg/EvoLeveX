import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTrustedStoreAmount } from '../src/lib/store-provider-amount.ts'

test('trusted amount preserves two-decimal precision and JPY amounts',()=>{
  assert.equal(parseTrustedStoreAmount('29.00','USD'),'29.00')
  assert.equal(parseTrustedStoreAmount('1955.00','JPY'),'1955.00')
  assert.equal(parseTrustedStoreAmount('999999999999.99','USD'),'999999999999.99')
})
test('trusted amount rejects JSON numbers and lossy conversion',()=>{
  for(const x of [29,29.001,NaN,Infinity,null,'29','29.0','29.001','-1.00','0.00']){
    assert.throws(()=>parseTrustedStoreAmount(x,'USD'))
  }
  assert.throws(()=>parseTrustedStoreAmount('1955.50','JPY'),/integral/)
  assert.throws(()=>parseTrustedStoreAmount('29.00','CHF'),/Unsupported/)
})
