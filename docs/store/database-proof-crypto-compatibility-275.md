# PR #275: database cryptographic verifier compatibility decision

**Status:** blocked for privileged execution; no change to deny-all DB gate.

## Verified environment

- Production PostgreSQL exposes installed `pgcrypto` 1.3.
- `pgsodium` is an available extension, **not installed**. Supabase documentation does not recommend adopting new `pgsodium` usage due to pending deprecation.
- Existing Node code signs Ed25519 over the ASCII bytes of a *base64url-encoded JSON payload* and encodes its 64-byte signature as base64url.
- `pgcrypto` provides digest, HMAC and PGP operations but **not a native Ed25519 verification interface for that Node proof**. A hash comparison is not an alternative to signature verification.

## Decision

Do **not** install `pgsodium`, switch silently to HMAC, implement bespoke Ed25519 in PL/pgSQL, or grant any role EXECUTE on `private.execute_evo_store_correlation_atomically`. Do **not** change `private.can_execute_evo_store_signed_correlation`: it must continue returning `false`.

A separate, reviewed technical design must select between:

1. A vetted database-side signature verification implementation independently tested against Node Ed25519 vectors and supported by the managed PostgreSQL environment; or
2. An isolated trusted worker where verification and operator authentication occur within a hardened execution trust boundary, while the database function independently authenticates worker identity, locks/rechecks the active operator role and attempt, and consumes the nonce atomically. A user-controllable PostgreSQL GUC is never an authentication credential.

Neither option is approved by this PR. Any new trust mechanism must include independently verified keys, issuer/audience checks, proof expiry, evidence digest binding, nonce replay prevention, current role checks, revocation, a restricted worker DB principal, and an audit trail for failed and successful attempts.

## Acceptance gates before implementation

- Disposable PostgreSQL 15 and 17 verification compatibility and known-answer Ed25519 vectors.
- Rejection of tampered proof, invalid signature, forged operator ID, expired audience, stale role, stale attempt and replay.
- Transaction concurrency and rollback tests, including revoked administrators.
- Credentials isolated from Vercel, browser, anon/authenticated and Supabase service-role processes.
- Successful result never means captured payment: `payment_ready=false`.
- Production migration and permission changes require separate security review and explicit rollout.

**No migration, new extension, database GRANT, live worker, order POST, payment capture or Printful activation in this PR.**
