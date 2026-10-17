# PR #276 — Database-authenticated worker principal: candidate architecture

**Recommendation for staging evaluation:** a dedicated PostgreSQL LOGIN role scoped to an isolated worker process, authenticated over TLS with separately managed credentials, rather than attempting to make PostgreSQL verify an unsupported Ed25519 proof format.

This is a **candidate**, not an approval to grant execution rights.

## Why this is materially different from request JWT claims

PostgreSQL authenticates a database login when establishing its connection. A direct connection's `session_user` derives from that login, whereas `request.jwt.claim.sub` is a mutable application session setting and does **not** authenticate a user. The `current_user` value inside SECURITY DEFINER functions becomes the function owner; do not use it as evidence of the calling LOGIN principal. Verify connection pooling, SET ROLE behavior, migration ownership and Supabase's managed-role limitations before trusting `session_user`.

The SQL trust boundary must authenticate the dedicated worker principal, then independently check the current operator role and attempt state in its protected transaction. The operator ID is an **attribution**, not proof of authentication; a compromised worker account must not be able to impersonate arbitrary operators. This remains a blocking issue requiring a reviewed actor-binding design.

## Minimal staging-only acceptance path

1. Isolate worker process and DB credential from Vercel, customer traffic, and general Supabase service-role use.
2. Define a fresh, non-inheriting, non-superuser DB LOGIN role with no BYPASSRLS, CREATEROLE or table modification privileges.
3. Test direct TLS connection using that role; validate `session_user` under SECURITY DEFINER and `SET ROLE` behavior on PostgreSQL 15 and 17.
4. Author a **new** tightly scoped function rather than granting the existing owner-only atomic entry point without changes. That function must refuse all other database principals, re-evaluate admin eligibility and attempt state under lock, verify trusted proof/actor binding and consume nonce in the same transaction.
5. Implement provider GET verification and authenticated Supabase operator session in the isolated worker; derive actor identity from verified authority and never a request body field.
6. Test disabled/revoked operators, forged GUCs, cross-attempt replay, competing workers, stale evidence, rollback, role misuse and credential revocation.
7. Only then consider a reviewed staging migration, restricted GRANT and separate production approval. Keep the production proof gate returning false and all payments/Printful disabled.

## Explicit non-goals

No database role is created. No DB credentials, SQL GRANT, worker deployment, proof gate change or payment capture is included here. The principal policy in this PR only checks configuration claims and is not itself database authentication.
