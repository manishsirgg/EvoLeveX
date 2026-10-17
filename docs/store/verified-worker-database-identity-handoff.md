# PR #269 — Verified identity to privileged SQL: required boundary

**Decision:** Do not pass an operator UUID or `request.jwt.claim.sub` GUC from an external request into the owner-only atomic correlation function and assume it authenticates the actor. Any database login with broad SQL execution can forge session claims.

## Proposed transaction handoff

1. A dedicated, non-public worker validates the incoming operator bearer against Supabase Auth and rechecks the live reconciliation role. The job payload contains only an attempt UUID.
2. The worker independently performs Razorpay receipt discovery, an order GET and immutable amount/receipt/currency checks. It reloads the attempt and authorization after network calls.
3. The worker connects with an isolated, narrowly permissioned database login **not present in the Vercel runtime or normal app environment**. Credentials come from a dedicated secret manager. The login must have no permissions to write arbitrary role assignments, auth tables, audit logs or provider attempts.
4. **Crucial:** the transaction authorization mechanism must be verified using an unforgeable token or authenticated worker identity under a function-owned trust root, and it must atomically recheck the operator role. Merely setting session GUCs or providing `p_operator_id` does not satisfy this. Database function access must be limited to that worker role, not `authenticated`, `anon` or `service_role`.
5. Nonce reservation, provider correlation and successful audit must commit atomically. Any rejected execution produces an independent durable attempt log; exception-triggered transaction rollback cannot retain an insert within that transaction.
6. Correlation returns `payment_ready:false`; it is never evidence of payment capture.

## Outstanding blockers

- Choose the worker's concrete deployment system and network/secret restrictions, then establish and test its machine identity.
- Design a signed short-lived proof with an explicit audience, issuer, nonce, attempt ID, verified operator ID and provider evidence hash. The DB-side verifier must trust a signing key available ONLY to the isolated worker, validate the signature with a vetted cryptographic implementation, and independently check active role and nonce atomically. Do not invent custom cryptography or rely on unsigned JSON.
- Prove a stolen worker credential alone cannot manufacture arbitrary operator claims; if the worker's signing and SQL credentials are both compromised, define detection and emergency revocation.
- Implement role, expiration, replay, revoked operator, conflicting provider, proof tampering and competing transaction tests in disposable PG15/17.
- Verify least-privilege grants via catalog queries; deploy only to staging after reviewed migration.
- Keep the Store reservation bridge disabled, Razorpay create-order POST disabled, capture disabled and Printful disabled.

**This PR deliberately introduces no database grants, JWT/session GUC impersonation, worker secrets, mutation API or production migration.**
