import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const user='19000000-0000-4000-8000-000000000001'
const address='99000000-0000-4000-8000-000000000001'
const variant='59000000-0000-4000-8000-000000000001'
const role=`SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',true);`
const path=name=>new URL(`../../supabase/migrations/${name}`,import.meta.url)
const checkoutKey=n=>`a9000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const invoke=async(psql,sql)=>{
 const result=await psql(['-Atq'],`BEGIN; ${role} SELECT ${sql}; COMMIT;`,{capture:true})
 return result.split('\n').find(line=>line.trim().startsWith('{'))?.trim()??''
}
const reserve=(n,qty=2)=>`public.create_evo_store_checkout('[{"variant_id":"${variant}","quantity":${qty}}]'::jsonb,'USD','${checkoutKey(n)}','${address}')`
const link=id=>`(SELECT row_to_json(t) FROM public.create_pending_evo_store_order('${id}'::uuid) t)`
const prices=id=>`UPDATE public.evo_store_checkouts SET shipping_total=0,tax_total=0,grand_total=subtotal WHERE id='${id}'`

export function registerStoreLinkedOrderExpiry(serialTest,{psql,query,resetDatabase}){
 serialTest('Store linked orders: incomplete totals fail closed, retry idempotence, release cancels atomically',async()=>{
   await resetDatabase()
   await psql([],await readFile(path('20261014030000_store_pending_order_conversion.sql'),'utf8'))
   await psql([],await readFile(path('20261014040000_store_linked_order_expiry_guard.sql'),'utf8'))
   await psql([],await readFile(path('20261008125840_evo_store_checkout_expiry_worker.sql'),'utf8'))
   await psql(['-1','-f',new URL('./supabase/tests/fixtures_store_checkout.sql',import.meta.url).pathname],'')
   const hold=JSON.parse(await invoke(psql,reserve(401)))
   assert.ok(hold.id)
   await assert.rejects(invoke(psql,link(hold.id)),/STORE_ORDER_TOTALS_NOT_FINAL/)
   assert.equal(query('SELECT count(*) FROM private.evo_store_checkout_order_links'),'0')
   await psql([],prices(hold.id))
   const first=JSON.parse(await invoke(psql,link(hold.id)))
   const second=JSON.parse(await invoke(psql,link(hold.id)))
   assert.equal(first.order_id,second.order_id)
   assert.equal(first.created,true)
   assert.equal(second.created,false)
   assert.equal(query('SELECT count(*) FROM private.evo_store_checkout_order_links'),'1')
   const order=query(`SELECT order_id FROM private.evo_store_checkout_order_links WHERE checkout_id='${hold.id}'`)
   assert.equal(query(`SELECT count(*) FROM public.order_items WHERE order_id='${order}' AND source='store'`),'1')
   await invoke(psql,`public.release_evo_store_checkout('${hold.id}')`)
   assert.equal(query(`SELECT status::text||':'||payment_status::text FROM public.orders WHERE id='${order}'`),'cancelled:failed')
   assert.equal(query(`SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='${variant}'`),'0')
   await assert.rejects(invoke(psql,link(hold.id)),/STORE_ORDER_RECONCILIATION_REQUIRED/)
 })
 serialTest('Store linked orders: expiry cancels and provider correlation blocks premature release',async()=>{
   // The prior serial test installed migrations into the disposable target.
   const hold=JSON.parse(await invoke(psql,reserve(402)))
   await psql([],prices(hold.id))
   await invoke(psql,link(hold.id))
   const order=query(`SELECT order_id FROM private.evo_store_checkout_order_links WHERE checkout_id='${hold.id}'`)
   await psql([],`BEGIN;
     UPDATE public.orders SET checkout_expires_at=now()-interval '1 second' WHERE id='${order}';
     UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour', expires_at=now()-interval '1 second' WHERE id='${hold.id}';
     COMMIT;`)
   await psql([],`BEGIN; SET LOCAL ROLE service_role; SELECT public.expire_evo_store_checkouts(25); COMMIT;`)
   assert.equal(query(`SELECT status::text FROM public.evo_store_checkouts WHERE id='${hold.id}'`),'expired')
   assert.equal(query(`SELECT status::text||':'||payment_status::text FROM public.orders WHERE id='${order}'`),'cancelled:failed')
   assert.equal(query(`SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='${variant}'`),'0')
   const next=JSON.parse(await invoke(psql,reserve(403)))
   await psql([],prices(next.id))
   await invoke(psql,link(next.id))
   const secondOrder=query(`SELECT order_id FROM private.evo_store_checkout_order_links WHERE checkout_id='${next.id}'`)
   await psql([],`INSERT INTO public.payments(order_id,provider,amount,currency,status,provider_order_id)
     VALUES('${secondOrder}','razorpay',20.50,'USD','pending','order_SYNTHETIC5001')`)
   await assert.rejects(invoke(psql,`public.release_evo_store_checkout('${next.id}')`),
     /STORE_ORDER_PROVIDER_RECONCILIATION_REQUIRED/)
   assert.equal(query(`SELECT status::text FROM public.evo_store_checkouts WHERE id='${next.id}'`),'active')
   assert.equal(query(`SELECT status::text FROM public.orders WHERE id='${secondOrder}'`),'pending')
   assert.equal(query(`SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='${variant}'`),'2')
 })
}
