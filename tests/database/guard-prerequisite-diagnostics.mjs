import assert from 'node:assert/strict'
import { readAtomicStoreMigrations, atomicStoreTransaction } from './helpers/atomic-store-migrations.mjs'

const diagnostics = `SELECT jsonb_build_object(
 'version',current_setting('server_version'),'encoding',current_setting('server_encoding'),
 'standard_conforming_strings',current_setting('standard_conforming_strings'),
 'check_function_bodies',current_setting('check_function_bodies'),
 'current_user',current_user,'session_user',session_user,
 'owner',pg_get_userbyid(p.proowner),'owner_ok',p.proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres'),
 'security_definer_ok',p.prosecdef,'kind_ok',p.prokind='f',
 'return_type_ok',p.prorettype='pg_catalog.trigger'::regtype,
 'proconfig',p.proconfig,'search_path_ok',p.proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[],
 'body_md5',md5(p.prosrc),'body_md5_ok',md5(p.prosrc)='b1ac65d9a274ab4c40a6451e78d790cb',
 'body_bytes',octet_length(p.prosrc),'cr_count',length(p.prosrc)-length(replace(p.prosrc,chr(13),'')),
 'public_execute_absent',NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE'),
 'anon_execute_absent',NOT has_function_privilege('anon',p.oid,'EXECUTE'),
 'authenticated_execute_absent',NOT has_function_privilege('authenticated',p.oid,'EXECUTE'))
 FROM pg_proc p WHERE p.oid='private.guard_evo_store_archived_product_inventory()'::regprocedure;`

export function registerGuardPrerequisiteDiagnostics(serialTest, { psql, query, objectsAbsent }) {
  serialTest('guard diagnosis: unchanged five-migration sequence reports every prerequisite', async () => {
    const migrations = await readAtomicStoreMigrations()
    // Diagnostic read is inside the disposable transaction immediately before D.
    // The separate atomic COMMIT test still executes the exact unchanged sequence.
    const prefix = atomicStoreTransaction(migrations.slice(0, 4)).replace(/COMMIT;$/, '')
    const output = await psql(['-Atq'], `${prefix}\n${diagnostics}\n${migrations[4]}\nROLLBACK;`, { capture: true })
    console.info(`guard prerequisite diagnostics: ${output.trim()}`)
    const row = JSON.parse(output.split('\n').find(line => line.startsWith('{')))
    for (const [key, value] of Object.entries(row)) {
      if (key.endsWith('_ok') || key.endsWith('_absent')) assert.equal(value, true, key)
    }
    assert.equal(row.encoding, 'UTF8')
    assert.equal(row.standard_conforming_strings, 'on')
    assert.equal(row.check_function_bodies, 'on')
    assert.equal(query(objectsAbsent), 't')
  })

  serialTest('guard diagnosis: CRLF editor transport changes only stored-body MD5 and fails closed', async () => {
    const migrations = await readAtomicStoreMigrations()
    // Disposable-only transport simulation, not a modification of any source file.
    const transmitted = migrations.slice(0, 4).map(sql => sql.replaceAll('\n', '\r\n'))
    const prefix = atomicStoreTransaction(transmitted).replace(/COMMIT;$/, '')
    let failedOutput = ''
    await assert.rejects(psql(['-Atq'], `${prefix}\n${diagnostics}\n${migrations[4]}\nCOMMIT;`, { capture: true }), error => {
      failedOutput = error.message
      return /EVO_STORE_INVENTORY_GUARD_PREREQUISITE/.test(error.message)
    })
    const row = JSON.parse(failedOutput.split('\n').find(line => line.startsWith('{')))
    assert.equal(row.body_md5_ok, false)
    assert.ok(row.cr_count > 0)
    for (const [key, value] of Object.entries(row)) {
      if ((key.endsWith('_ok') || key.endsWith('_absent')) && key !== 'body_md5_ok') assert.equal(value, true, key)
    }
    console.info(`CRLF transport diagnostic (hypothesis only): ${JSON.stringify(row)}`)
    assert.equal(query(objectsAbsent), 't', 'failed D rolled back all simulated changes')
  })
}
