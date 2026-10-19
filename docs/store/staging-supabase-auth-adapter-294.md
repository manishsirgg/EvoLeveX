# PR #294 — Staging Supabase Auth identity adapter

This server-side **staging-only** adapter implements the existing `WorkerIdentityDependencies` contract using `supabase.auth.getUser(bearerToken)`, requiring an actual verified account ID and confirmed email. Current administrator authorization is obtained from a separate trusted asynchronous `liveRoleLookup(operatorId)` callback. `issueBoundStoreOperatorTicket` already verifies the same token and current role again immediately before invoking its injected ticket writer.

The adapter deliberately DOES NOT instantiate a service-role client, expose an HTTP endpoint, create a worker, configure credentials, issue database tickets, or grant SQL execution rights. The caller must instantiate the auth client in a non-public trusted runtime and provide a **real server-owned** role lookup over current `public.user_roles` joined to `public.roles`, not JWT metadata, browser JSON or cache. Integration tests use test doubles and prove behavior only at this interface.

**Outstanding security blockers:** a trusted role-lookup implementation and real issuer are not wired; authenticating a human before ticket issuance also does not remove the SQL issuer-principal impersonation risk; real Store correlation still requires owner rights and a spoofable session claim; independent Razorpay verification and database-wide worker restriction remain pending.

No production migration, production issuer, live ticket-write callback, restricted worker grant, Razorpay creation/capture or Printful operations.
