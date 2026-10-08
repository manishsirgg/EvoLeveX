# Store checkout expiry orchestration — Phase 2J-C step 2

**Recurring Store scheduling is disabled.** `vercel.json` retains only the
existing FX cron (`/api/cron/fx-rates`, `0 2 * * *`). This change adds an endpoint,
not authorization to deploy database SQL, invoke production cleanup, or enable a
schedule. Do not test this endpoint against production for validation.

## Endpoint and security

`GET /api/cron/store-checkout-expiry` runs dynamically on Node.js and returns
`Cache-Control: no-store` plus `Vercel-CDN-Cache-Control: no-store`. It requires
exact `Authorization: Bearer <CRON_SECRET>` syntax and compares SHA-256 token
digests with Node's constant-time comparison. Missing, malformed, or incorrect
credentials return the same sanitized 401 before creating a service-role client.
The exact path (including its optional trailing slash) bypasses browser-session
Supabase proxy processing. Other paths, including the FX cron, retain coverage.
Server-only imports prevent client use of the handler and service-role factory.

After authorization, the existing service-role factory creates one client with
session persistence and refresh disabled. It calls only
`expire_evo_store_checkouts` with `p_batch_size: 25`. Each default POST RPC request
is an **independent PostgREST transaction**. No shared application transaction,
direct inventory SQL, customer authentication, or automatic HTTP retry is used.
Three requests is the upper bound: at most 75 potential expirations. Database
service-role ACLs continue to provide the privileged execution boundary.

## Execution, outcomes and observability

A monotonic application clock targets 20 seconds of work. A new RPC starts only
with at least five seconds remaining; each has a five-second HTTP abort signal.
This signal bounds transport waiting; it **does not guarantee PostgreSQL rollback**
or cancel a transaction already accepted by the database. A lost response can
represent committed work. The invocation stops without retrying; a later run uses
the database worker's existing idempotent lifecycle and locks. A runtime kill,
event-loop delay or underlying transport can still exceed the application target.
No `maxDuration` is asserted while the effective deployment limit is unverified.

Responses validate all seven expected aggregate fields, integer bounds,
accounting equalities and limit flags. Extra fields and malformed responses fail
closed. Totals include only confirmed, validated responses; they are not a claim
about unacknowledged commits. The limit flags mean **any completed call** reached
the respective limit, not that the queue is now empty.

- `SUCCESS` (200): no operational errors, contention or reconciliation failures.
- `DEGRADED` (200): reconciliation failures, observed contention, or work deadline.
  This includes a busy 100-candidate prefix with no successful expiration.
- `FAILED` (503): configuration, RPC/transport error, or invalid response.
- Unauthorized requests return 401 with no privileged client or database call.

Only a productive full batch continues. Zero progress and partial batches stop;
zero expired/examined **never** claims an empty queue. Logs emit one constructed
report: random invocation UUID, monotonic duration, RPC-call count, validated
aggregate totals, classification, safe error category and stop reason. Failed and
degraded runs use error/warning levels. No request headers, tokens, customer IDs,
addresses, snapshots, fingerprints, raw exceptions or SQL diagnostics are logged.
Alerting must inspect DEGRADED logs as well as 503s; HTTP 200 alone is insufficient.

## Deployment gates before scheduling

Proposed future schedule: `* * * * *` (UTC), **provisional and not configured**.
Read-only Vercel inspection on 2026-10-08 reported the connected project's Node.js
runtime as `24.x`. The connector exposed neither the deployed plan nor effective
function duration; no timeout/plan capability has been inferred from those results.

Before enabling any recurring execution, separately verify:

1. Actual Vercel plan, supported cron frequency and job limits. If every minute is
   unsupported, select a cadence supported by that verified plan (for example,
   daily only if that is its supported interval), and assess whether delayed
   inventory release is acceptable. Do not upgrade subscriptions automatically.
2. Effective function timeout and sufficient headroom for the 20-second target,
   initialization, response and logging. Configure `maxDuration` only against
   verified platform limits; confirm generated deployment settings afterward.
3. Production `CRON_SECRET` and server-only `SUPABASE_SERVICE_ROLE_KEY`/Supabase URL
   configuration, without disclosing values. Confirm service-role execution is
   permitted and clients receive no privileged credentials.
4. Deployment of the Phase 2J-C database RPC and its grants. Git merge and disposable
   CI do not establish that a production database has applied the migration.
5. Actual PostgREST/database statement and lock timeouts, transport timeouts, and
   how unknown commit outcomes are monitored. HTTP abort is not a DB timeout.
6. Operational alerts for failed/degraded runs, reconciliation failures and expiry
   backlog; review minimum cadence versus the 30-minute reservation lifetime.

Known database limitations remain: persistent contention in the bounded oldest
candidate prefix may delay later candidates; cross-checkout aggregate reservation
reconciliation is outside this worker. Failure records are transactional and can
remain as historical records if customers later finish their checkout. Healthy
candidates precede due reconciliation retries. No global queue drain guarantee is
made by an invocation.

## Validation

`npm test`, `npm run typecheck`, `npm run lint`, and
`npm run test:database:harness` check the application integration. The focused
`tests/store-checkout-expiry-cron.test.mjs` executes the production handler and RPC
adapter with synthetic credentials/HTTP responses, verifies real Next.js matcher
behavior, and asserts FX-only scheduling. Disposable Supabase CI retains all
existing migration, pgTAP and real separate-session concurrency tests. No database
schema, inventory guard, customer checkout behavior or existing test is weakened.
