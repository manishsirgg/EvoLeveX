import test from 'node:test'
import assert from 'node:assert/strict'
import { discoverStoreOrderFromReceiptPages } from '../src/lib/store-razorpay-receipt-pages.ts'
import { readFile } from 'node:fs/promises'

const receipt='evs_1234567890abcdef1234567890abcdef'
const expected={receipt,amount:'29.00',currency:'USD'}
const order=(id='order_12345678')=>({id,receipt,amount:2900,currency:'USD'})
const page=items=>({entity:'collection',count:items.length,items})

test('receipt list returns unique verified order from a complete short page',async()=>{
 const calls=[]
 const result=await discoverStoreOrderFromReceiptPages(expected,async(skip,count)=>{
   calls.push([skip,count])
   return page([order()])
 })
 assert.equal(result.id,'order_12345678')
 assert.deepEqual(calls,[[0,100]])
})
test('100-row page requires a second page and checks ambiguity across pages',async()=>{
 const filler=Array.from({length:99},(_,i)=>({...order('order_'+String(i).padStart(8,'0')),receipt:'different'}))
 const calls=[]
 const result=await discoverStoreOrderFromReceiptPages(expected,async(skip,count)=>{
   calls.push([skip,count]);return skip===0?page([...filler,order()]):page([])
 })
 assert.equal(result.id,'order_12345678')
 assert.deepEqual(calls,[[0,100],[100,100]])
 await assert.rejects(discoverStoreOrderFromReceiptPages(expected,async skip=>
  skip===0?page([...filler,order()]):page([order('order_87654321')])
 ),/AMBIGUOUS/)
})
test('fails closed on ten full pages and malformed counts',async()=>{
 await assert.rejects(discoverStoreOrderFromReceiptPages(expected,async()=>page(Array.from({length:100},()=>({...order(),receipt:'other'})))),/INCOMPLETE/)
 await assert.rejects(discoverStoreOrderFromReceiptPages(expected,async()=>({entity:'collection',count:99,items:[order()]})),/INVALID/)
})
test('server adapter stays read-only and closed to HTTP routes',async()=>{
 const code=await readFile(new URL('../src/lib/store-razorpay-receipt-list-read.ts',import.meta.url),'utf8')
 assert.match(code,/import 'server-only'/)
 assert.match(code,/method: 'GET'/)
 assert.match(code,/url\.searchParams\.set\('receipt', expected\.receipt\)/)
 assert.doesNotMatch(code,/\.rpc\(|\.insert\(|\.update\(|createServiceRoleClient|export (?:async )?function (?:GET|POST)/)
})
