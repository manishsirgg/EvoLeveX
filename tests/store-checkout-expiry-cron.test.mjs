import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'
import nextTesting from 'next/experimental/testing/server.js'
// Installed Next.js 16.2.10 still exports the matcher utility under its legacy name.
const { unstable_doesMiddlewareMatch: doesProxyMatch } = nextTesting

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
// Execute the actual server code in Node, substituting only the framework's
// build-time marker/alias wiring. No handler logic is replaced or reimplemented.
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(
  source.replace(/^import 'server-only'\s*$/m, ''),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText).toString('base64')}`
const coreUrl = moduleUrl(read('src/lib/cron/store-checkout-expiry.ts'))
const { createStoreCheckoutExpiryHandler, validateExpiryCounts } = await import(coreUrl)
const proxySource = read('proxy.ts')
const matcher = /matcher:\s*(\[[\s\S]*?\])/.exec(proxySource)[1]
const { config } = await import(moduleUrl(`export const config = { matcher: ${matcher} }`))

const secret = 'SYNTHETIC_CRON_SECRET'
const request = header => new Request('https://example.test/api/cron/store-checkout-expiry', {
  headers: header === undefined ? {} : { Authorization: header },
})
const full = () => ({ examined: 25, claimed: 25, expired: 25, busy: 0,
  reconciliation_failed: 0, scan_limit_reached: false, batch_limit_reached: true })
const empty = () => ({ examined: 0, claimed: 0, expired: 0, busy: 0,
  reconciliation_failed: 0, scan_limit_reached: false, batch_limit_reached: false })
function harness(replies = [empty()], options = {}) {
  const logs = []
  let clients = 0; let calls = 0; let active = 0; let maxActive = 0
  const dependencies = {
    secret: () => options.secret === undefined ? secret : options.secret,
    invocationId: () => 'synthetic-invocation', now: options.now ?? (() => 0), log: report => logs.push(report),
    createRpc: () => {
      clients += 1
      if (options.configurationError) throw new Error('SUPABASE_SERVICE_ROLE_KEY=SYNTHETIC_PRIVILEGED_VALUE')
      return async signal => {
        assert.ok(signal instanceof AbortSignal)
        active += 1; maxActive = Math.max(active, maxActive)
        const value = replies[calls++]
        try {
          if (value instanceof Error) throw value
          if (typeof value === 'function') return await value(signal)
          return { data: value, error: null, status: 200 }
        } finally { active -= 1 }
      }
    },
  }
  return { GET: createStoreCheckoutExpiryHandler(dependencies), logs,
    state: () => ({ clients, calls, maxActive }) }
}
const invoke = async h => {
  const response = await h.GET(request(`Bearer ${secret}`))
  return { response, body: await response.json() }
}

test('cron authentication fails closed before any privileged client initialization', async () => {
  for (const header of [undefined, '', 'Basic SYNTHETIC_CRON_SECRET', 'bearer SYNTHETIC_CRON_SECRET',
    'Bearer', 'Bearer ', 'Bearer wrong', 'Bearer SYNTHETIC_CRON_SECRET extra',
    'Bearer SYNTHETIC_CRON_SECRET,Bearer SYNTHETIC_CRON_SECRET']) {
    const h = harness()
    const response = await h.GET(request(header))
    assert.equal(response.status, 401)
    assert.deepEqual(h.state(), { clients: 0, calls: 0, maxActive: 0 })
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(h.logs[0].error_category, 'unauthorized')
    assert.doesNotMatch(JSON.stringify(await response.json()), /SYNTHETIC_CRON_SECRET/)
  }
  for (const missing of ['', null, 'bad secret']) {
    const h = harness([], { secret: missing })
    assert.equal((await h.GET(request(`Bearer ${secret}`))).status, 401)
    assert.equal(h.state().clients, 0)
  }
})

test('authorized handler creates one service client and makes exactly three sequential calls at most', async () => {
  const h = harness([full(), full(), full(), full()])
  const { response, body } = await invoke(h)
  assert.equal(response.status, 200)
  assert.equal(body.classification, 'SUCCESS')
  assert.equal(body.stop_reason, 'call_limit')
  assert.equal(body.totals.expired, 75)
  assert.equal(body.rpc_calls, 3)
  assert.deepEqual(h.state(), { clients: 1, calls: 3, maxActive: 1 })
  assert.equal(h.logs.length, 1)
})

test('partial batch succeeds once; zero expiry never claims an empty queue or triggers repeated calls', async () => {
  for (const counts of [empty(), { ...empty(), examined: 2, claimed: 2, expired: 2 }]) {
    const h = harness([counts, full()])
    const { body } = await invoke(h)
    assert.equal(body.classification, 'SUCCESS')
    assert.equal(body.rpc_calls, 1)
    assert.equal(body.totals.expired, counts.expired)
    assert.equal(Object.hasOwn(body, 'queue_empty'), false)
  }
})

test('known reconciliation failures and busy prefix report degraded and stop on zero progress', async () => {
  const cases = [
    [{ ...empty(), examined: 2, claimed: 2, expired: 1, reconciliation_failed: 1 }, 'reconciliation'],
    [{ ...empty(), examined: 1, claimed: 1, reconciliation_failed: 1 }, 'reconciliation'],
    [{ ...empty(), examined: 100, busy: 100, scan_limit_reached: true }, 'contention'],
  ]
  for (const [counts, category] of cases) {
    const h = harness([counts, full()])
    const { body } = await invoke(h)
    assert.equal(body.classification, 'DEGRADED')
    assert.equal(body.error_category, category)
    assert.equal(body.rpc_calls, 1)
    assert.deepEqual(body.totals, counts)
  }
})

test('contract validation rejects extra details, impossible accounting and malformed fields', async () => {
  const invalid = [null, [], 'data', {}, { ...full(), customer_id: 'SYNTHETIC_CUSTOMER' },
    { ...full(), expired: -1 }, { ...full(), expired: 26 }, { ...full(), expired: '25' },
    { ...full(), examined: 101 }, { ...full(), examined: 0 }, { ...full(), claimed: 24 },
    { ...full(), expired: NaN }, { ...full(), busy: Infinity },
    { ...full(), batch_limit_reached: false }, { ...full(), scan_limit_reached: 'false' },
    { ...full(), scan_limit_reached: true }, { ...empty(), examined: 1.5 },
  ]
  for (const value of invalid) {
    assert.equal(validateExpiryCounts(value), null)
    const h = harness([value, full()])
    const { response, body } = await invoke(h)
    assert.equal(response.status, 503)
    assert.equal(body.classification, 'FAILED')
    assert.equal(body.error_category, 'invalid_response')
    assert.equal(body.rpc_calls, 1)
    assert.equal(body.totals.expired, 0)
    assert.doesNotMatch(JSON.stringify(body), /SYNTHETIC_CUSTOMER/)
  }
})

test('partial success followed by transport failure retains confirmed totals and stops without retry', async () => {
  const h = harness([full(), new Error('Authorization: Bearer SYNTHETIC_PRIVATE_TOKEN; customer address; raw SQL'), full()])
  const { response, body } = await invoke(h)
  assert.equal(response.status, 503)
  assert.equal(body.classification, 'FAILED')
  assert.equal(body.error_category, 'rpc_transport')
  assert.equal(body.rpc_calls, 2)
  assert.equal(body.totals.expired, 25)
  assert.doesNotMatch(JSON.stringify([body, h.logs]), /SYNTHETIC_PRIVATE_TOKEN|raw SQL|customer address|Authorization/)
})

test('configuration and RPC errors are safely categorized without raw diagnostics', async () => {
  const h = harness([], { configurationError: true })
  const { body } = await invoke(h)
  assert.equal(body.error_category, 'configuration')
  assert.equal(body.classification, 'FAILED')
  assert.equal(body.rpc_calls, 0)
  assert.doesNotMatch(JSON.stringify([body, h.logs]), /SYNTHETIC_PRIVILEGED_VALUE|SUPABASE_SERVICE_ROLE_KEY/)
  for (const status of [0, 500]) {
    const failed = harness([() => ({ data: null, error: { message: 'raw SQL SYNTHETIC_CHECKOUT_ID' }, status })])
    const result = await invoke(failed)
    assert.equal(result.body.error_category, status === 0 ? 'rpc_transport' : 'rpc_error')
    assert.equal(result.response.status, 503)
    assert.doesNotMatch(JSON.stringify([result.body, failed.logs]), /raw SQL|SYNTHETIC_CHECKOUT_ID/)
  }
})

test('deadline reserves a full request budget before another call and bounds late completion', async () => {
  let elapsed = 0
  const h = harness([() => { elapsed = 15_001; return { data: full(), error: null } }, full()], { now: () => elapsed })
  const { body } = await invoke(h)
  assert.equal(body.rpc_calls, 1)
  assert.equal(body.classification, 'DEGRADED')
  assert.equal(body.error_category, 'deadline')
  assert.equal(body.stop_reason, 'deadline')
  assert.equal(body.duration_ms, 15_001)
  elapsed = 0
  const late = harness([() => { elapsed = 20_001; return { data: empty(), error: null } }], { now: () => elapsed })
  assert.equal((await invoke(late)).body.error_category, 'deadline')
  let tick = 0
  const before = harness([], { now: () => (++tick === 1 ? 0 : 16_000) })
  assert.equal((await invoke(before)).body.rpc_calls, 0)
})

test('actual route uses independent POST RPC requests, fixed batch and no hidden SDK retries', async () => {
  const routeSource = read('src/app/api/cron/store-checkout-expiry/route.ts')
  const requests = []
  const serviceClient = createClient('https://synthetic.example.test', 'SYNTHETIC_SERVICE_ROLE_KEY', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, options) => {
      requests.push({ url: String(url), method: options.method, body: JSON.parse(options.body), signal: options.signal })
      return Response.json(full())
    } },
  })
  // Wire only the service client import to the synthetic HTTP transport; GET
  // remains exactly the production export, including its RPC adapter.
  const clientModule = moduleUrl('export const createServiceRoleClient = () => globalThis.__expiryTestClient')
  const source = routeSource.replace("'@/lib/cron/store-checkout-expiry'", JSON.stringify(coreUrl))
    .replace("'@/lib/supabase/service-role'", JSON.stringify(clientModule))
  const previousSecret = process.env.CRON_SECRET
  const previousLog = console.info
  process.env.CRON_SECRET = secret
  globalThis.__expiryTestClient = serviceClient
  console.info = () => {}
  try {
    const route = await import(moduleUrl(source))
    assert.equal(route.dynamic, 'force-dynamic'); assert.equal(route.runtime, 'nodejs')
    const response = await route.GET(request(`Bearer ${secret}`))
    assert.equal((await response.json()).totals.expired, 75)
    assert.equal(requests.length, 3)
    for (const call of requests) {
      assert.equal(call.method, 'POST')
      assert.equal(new URL(call.url).pathname, '/rest/v1/rpc/expire_evo_store_checkouts')
      assert.deepEqual(call.body, { p_batch_size: 25 })
      assert.ok(call.signal instanceof AbortSignal)
    }
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previousSecret
    delete globalThis.__expiryTestClient
    console.info = previousLog
  }
  assert.match(routeSource, /\.retry\(false\)/)
  assert.doesNotMatch(routeSource, /\.from\(|transaction\(/)
})

test('production logger emits only constructed aggregate records at the expected severity', async () => {
  const previous = { info: console.info, warn: console.warn, error: console.error }
  const logs = []
  console.info = (...args) => logs.push(['info', ...args])
  console.warn = (...args) => logs.push(['warn', ...args])
  console.error = (...args) => logs.push(['error', ...args])
  try {
    for (const [data, error, expectedLevel] of [
      [empty(), null, 'info'],
      [{ ...empty(), examined: 1, claimed: 1, reconciliation_failed: 1 }, null, 'warn'],
      [null, { message: 'SYNTHETIC_SENSITIVE_SQL_AND_ADDRESS', details: secret }, 'error'],
    ]) {
      const GET = createStoreCheckoutExpiryHandler({ secret: () => secret,
        invocationId: () => 'synthetic-log-id', now: () => 0,
        createRpc: () => async () => ({ data, error, status: 500 }) })
      await GET(request(`Bearer ${secret}`))
      assert.equal(logs.at(-1)[0], expectedLevel)
      assert.deepEqual(Object.keys(logs.at(-1)[2]).sort(), [
        'classification', 'duration_ms', 'error_category', 'invocation_id', 'rpc_calls', 'stop_reason', 'totals',
      ])
    }
    assert.doesNotMatch(JSON.stringify(logs), /SYNTHETIC_SENSITIVE_SQL_AND_ADDRESS|SYNTHETIC_CRON_SECRET/)
  } finally { Object.assign(console, previous) }
})

test('proxy exclusion is exact and preserves browser authentication for all other paths', () => {
  const matches = url => doesProxyMatch({ config, nextConfig: {}, url })
  for (const url of ['/api/cron/store-checkout-expiry', '/api/cron/store-checkout-expiry/', '/api/cron/store-checkout-expiry?manual=1']) assert.equal(matches(url), false, url)
  for (const url of ['/api/cron/fx-rates', '/api/cron/store-checkout-expiry-extra', '/api/cron/store-checkout-expiry/nested', '/admin/store', '/account', '/api/payments/razorpay/orders', '/store']) assert.equal(matches(url), true, url)
  for (const url of ['/_next/static/chunk.js', '/_next/image', '/favicon.ico', '/image.png']) assert.equal(matches(url), false, url)
})

test('Store scheduling is absent and existing FX scheduling/security are preserved', () => {
  const configuration = JSON.parse(read('vercel.json'))
  assert.deepEqual(configuration.crons, [{ path: '/api/cron/fx-rates', schedule: '0 2 * * *' }])
  assert.match(read('src/app/api/cron/fx-rates/route.ts'), /timingSafeEqual/)
  assert.match(read('src/lib/cron/store-checkout-expiry.ts'), /import 'server-only'/)
  assert.match(read('src/app/api/cron/store-checkout-expiry/route.ts'), /import 'server-only'/)
})
