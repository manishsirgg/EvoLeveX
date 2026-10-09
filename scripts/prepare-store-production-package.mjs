// Generates files only; no database client or connection is used.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { sha256 } from '../tests/database/helpers/baseline.mjs'
import { ATOMIC_STORE_MIGRATIONS } from '../tests/database/helpers/atomic-store-migrations.mjs'
import { COMPATIBLE_STORE_MIGRATIONS, readCompatibleStoreMigrations } from '../tests/database/helpers/compatible-store-migrations.mjs'

const output = resolve(process.argv[2] ?? 'work/store-crlf-deployment-package')
const bodies = await readCompatibleStoreMigrations() // validates all original hashes too
await mkdir(output, { recursive: true })
const chunks = ['-- Supersedes the strict-LF deployment package. No scheduling.\nBEGIN;\n',
  "SET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '60s';\n"]
for (const [index, [name]] of COMPATIBLE_STORE_MIGRATIONS.entries()) {
  chunks.push(`\n-- BEGIN EXACT MIGRATION ${name}\n`, bodies[index], `\n-- END EXACT MIGRATION ${name}\n`)
}
chunks.push('\nCOMMIT;\n')
const script = chunks.join('')
for (const [index, [name, checksum]] of COMPATIBLE_STORE_MIGRATIONS.entries()) {
  const begin = `-- BEGIN EXACT MIGRATION ${name}\n`
  const end = `\n-- END EXACT MIGRATION ${name}`
  const body = script.slice(script.indexOf(begin) + begin.length, script.indexOf(end))
  if (body !== bodies[index] || sha256(Buffer.from(body)) !== checksum) throw new Error(`Boundary integrity: ${name}`)
}
const files = ['A-atomic-production-migrations.sql']
await writeFile(resolve(output, files[0]), script)
for (const name of ['B-pre-execution-verification.sql', 'C-post-deployment-verification.sql', 'D-DEPLOYMENT-RUNBOOK.md']) {
  await writeFile(resolve(output, name), await readFile(new URL(`../docs/deployment/store-crlf/${name}`, import.meta.url)))
  files.push(name)
}
for (const [name, entries] of [['migration-sha256.txt', COMPATIBLE_STORE_MIGRATIONS], ['original-migration-sha256.txt', ATOMIC_STORE_MIGRATIONS]]) {
  await writeFile(resolve(output, name), entries.map(([migration, hash]) => `${hash}  ${migration}\n`).join(''))
  files.push(name)
}
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
await writeFile(resolve(output, 'BUILD-AND-VALIDATION.txt'), `Source commit: ${head}\nDraft PR: https://github.com/manishsirgg/EvoLeveX/pull/161\nCI evidence must be recorded after the final commit succeeds; generation does not certify CI.\nNo production execution. Remaining runbook gates apply.\n`)
files.push('BUILD-AND-VALIDATION.txt')
const hashes = await Promise.all(files.map(async name => `${sha256(await readFile(resolve(output, name)))}  ${name}\n`))
await writeFile(resolve(output, 'artifact-sha256.txt'), hashes.join(''))
console.info(`Generated checksum-verified deployment package: ${output}`)
