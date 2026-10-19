# PR #295 — Server-owned live Store administrator lookup

Adds a staging-only PostgreSQL query boundary that checks current `public.user_roles` JOIN `public.roles` for `admin` or `super_admin`. The query takes a **bound UUID parameter** (`$1::uuid`), never caller-built SQL. Results are boolean-only; malformed IDs, missing authorization, multiple rows or database errors fail closed. No role result is cached. It can be supplied as the `liveRoleLookup` dependency to the existing Supabase `getUser(token)` staging identity adapter; that adapter repeats the live lookup before ticket issuance.

The injected query dependency MUST come from an independently configured server-owned, **read-only** PostgreSQL connection with least-privilege SELECT over the two role tables (or an equivalently restricted view). These credentials must not be exposed to clients or broad app routes. This PR does not create a connection pool, credentials, operator endpoint, ticket issuer or privileged executor. Application tests use query doubles, not a live Supabase database.

**Important limitation:** The role query validates current membership for a UUID supplied by the authenticated operator-binding layer; by itself it authenticates no human. The production ticket issuer and worker are still disconnected, and the legacy owner-only real correlation function remains unsuitable for granting restricted-worker EXECUTE because its `auth.uid()` is a mutable PostgreSQL claim.

No production database migration, worker privileges, Razorpay order creation/capture or Printful fulfillment.
