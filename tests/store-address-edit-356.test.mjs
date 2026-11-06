import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
test('address edit uses owner scoping and leaves default unchanged',async()=>{
 const actions=await read('src/app/account/addresses/actions.ts')
 const page=await read('src/app/account/addresses/page.tsx')
 const form=await read('src/app/account/addresses/edit-address-form.tsx')
 const edit=actions.slice(actions.indexOf('export async function updateShippingAddress('))
 for(const value of ["db.auth.getUser()","typeof id!=='string'",".eq('id',id).eq('user_id',user.id)","select('id').maybeSingle()","revalidatePath('/store/checkout')"]){
  assert.ok(edit.includes(value),value)
 }
 assert.doesNotMatch(edit,/is_default:|user_id:/)
 assert.ok(page.includes('<EditAddressForm address={a}/>'))
 assert.ok(form.includes('action={action}'))
 assert.ok(form.includes('defaultValue={address.address_line1}'))
})
