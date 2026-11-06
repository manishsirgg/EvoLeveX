import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('atomic shipping default RPC is invoker-scoped, authorized and transactional',async()=>{
 const sql=await read('supabase/migrations/20261106090000_shipping_address_atomic_default.sql')
 for(const marker of [
  'security invoker',"v_user_id uuid := auth.uid()",
  'pg_catalog.pg_advisory_xact_lock','where id = p_address_id and user_id = v_user_id',
  'for update','set is_default = false','set is_default = true',
  'revoke all on function public.set_default_shipping_address(uuid)',
  'grant execute on function public.set_default_shipping_address(uuid) to authenticated',
 ])assert.ok(sql.includes(marker),marker)
 assert.ok(sql.indexOf('perform 1 from public.addresses')<sql.indexOf('set is_default = false'))
 assert.ok(sql.indexOf('set is_default = false')<sql.indexOf('set is_default = true'))
 assert.doesNotMatch(sql,/security definer|create role|payment|printful/i)
})
test('default address button calls authenticated RPC and refreshes checkout',async()=>{
 const actions=await read('src/app/account/addresses/actions.ts')
 const page=await read('src/app/account/addresses/page.tsx')
 const button=await read('src/app/account/addresses/default-address-button.tsx')
 const action=actions.slice(actions.indexOf('export async function setDefaultShippingAddress('))
 for(const marker of ["db.auth.getUser()","db.rpc('set_default_shipping_address',{p_address_id:id})","revalidatePath('/account/addresses')","revalidatePath('/store/checkout')"])
  assert.ok(action.includes(marker),marker)
 assert.doesNotMatch(action,/\.update\(|\.insert\(|\.delete\(/)
 assert.ok(page.includes('!a.is_default?<DefaultAddressButton addressId={a.id}/>'))
 assert.ok(button.includes('useActionState(setDefaultShippingAddress,initial)'))
})
