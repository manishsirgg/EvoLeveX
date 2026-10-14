'use client'
import {useState} from 'react'
import {uploadApprovedHoodieMockup} from './actions'
export function HoodieMockupUploadControl({authorized}:{authorized:boolean}) {
  const [busy,setBusy]=useState(false)
  const [attempted,setAttempted]=useState<string[]>([])
  const [status,setStatus]=useState('')
  async function upload(color:'BLACK'|'NAVY') {
    if(!authorized||busy||attempted.includes(color))return
    if(!window.confirm(`Upload approved ${color} hoodie preview exactly once? The draft remains unpublished.`))return
    setAttempted(v=>[...v,color]);setBusy(true);setStatus('')
    try {
      const result=await uploadApprovedHoodieMockup(color)
      setStatus(result.ok?`${color} image verified and saved. Refresh hoodie gallery to verify.`:
        `${color} upload not confirmed (${result.code}). Do not retry until ledger and storage inspection.`)
    }catch {setStatus('Outcome unknown. Do not retry; inspect ledger and Storage.')}
    finally {setBusy(false)}
  }
  return <section className="mt-6 border border-amber-400/30 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Hoodie mockup synchronization</h2>
    <p className="mt-2 text-sm text-zinc-400">Only the two reviewed Black and Navy preview files. Secure uploads use a one-owner claim, non-overwrite Storage write, SHA-256 verification and token-fenced completion. No price, inventory or publication changes.</p>
    {!authorized&&<p className="mt-3 text-amber-300">Locked. Independent server-side media authorization is OFF.</p>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" disabled={!authorized||busy||attempted.includes('BLACK')} onClick={()=>upload('BLACK')} className="border border-amber-300 px-4 py-3 font-semibold text-amber-200 disabled:opacity-40">Upload Black preview once</button>
      <button type="button" disabled={!authorized||busy||attempted.includes('NAVY')} onClick={()=>upload('NAVY')} className="border border-amber-300 px-4 py-3 font-semibold text-amber-200 disabled:opacity-40">Upload Navy preview once</button>
    </div>
    {status&&<p role="status" className="mt-3 text-amber-300">{status}</p>}
  </section>
}
