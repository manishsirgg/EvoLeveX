'use client'
import { useState } from 'react'
import { seedHoodieDraftPrices } from './actions'
export function HoodiePriceSeedControl() {
  const [approved,setApproved]=useState(false)
  const [pending,setPending]=useState(false)
  const [message,setMessage]=useState('')
  const [attempted,setAttempted]=useState(false)
  async function seed() {
    if(!approved||pending||attempted)return
    if(!window.confirm('Insert all 10 merchant-confirmed USD prices as INACTIVE draft price records once? This does not publish products or enable checkout.'))return
    setAttempted(true);setPending(true);setMessage('')
    try {
      const result=await seedHoodieDraftPrices()
      setMessage(result.ok?`10 inactive USD price records inserted. Verify in Evo Store. Do not retry.`:`No confirmed insert: ${result.code}. Inspect database before any retry.`)
    } catch {setMessage('Outcome uncertain. Inspect database records; do not retry.')}
    finally {setPending(false)}
  }
  return <section className="mt-6 border border-amber-400/30 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Hoodie USD draft pricing — controlled one-time seed</h2>
    <p className="mt-2 text-sm text-zinc-400">Requires independent production authorization. Revalidates the 10 Printful variant prices, then inserts only inactive price records atomically. Existing prices prevent the entire insert. No images, inventory, variants, or publication status change.</p>
    <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} /> I verified USD prices (S–XL $91.50, 2XL $94.50) and authorize one inactive draft-price seed.</label>
    <button type="button" disabled={!approved||pending||attempted} onClick={seed} className="mt-3 border border-amber-300 px-4 py-3 font-semibold text-amber-200 disabled:opacity-40">{pending?'Applying…':'Seed 10 inactive USD prices once'}</button>
    {message && <p role="status" className="mt-3 text-amber-300">{message}</p>}
  </section>
}
