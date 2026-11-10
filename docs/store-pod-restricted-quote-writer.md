# POD quote writer — restricted capability only (PR #374)

This introduces an isolated server-only persistence adapter and a pure, strict monetary/evidence validation contract. **No caller, connection pool, DB role, grants, RLS policy, application route, payment or Printful order submission is introduced.**

## Trust boundary

`persistPreparedPodQuoteWithRestrictedSession(evidence, session)` expects an independently verified, trusted evidence envelope from a *future* isolated worker. It **must not** be called directly with JSON from customers, admin browsers, existing API handlers or unverified Printful payloads.

The adapter validates UUID identity, 64-character destination digest, currency/destination identifiers, exact two-decimal positive line prices, safe line quantities, exact integer-minor-unit subtotal, a provider shipping observation no older than two minutes and a quote expiry within fifteen minutes. It starts a serializable SQL transaction, proves that **both `current_user` and `session_user` exactly equal `evo_store_pod_quote_writer`**, inserts one private quote header and all its lines as parameterized statements, checks the existing deferred database quote integrity constraints immediately, and commits. Failures are rolled back and no raw DB error is exposed.

**Do not grant any privileges just to make this adapter run.** The POD private tables remain inaccessible to application roles. The dedicated role does not yet exist and there is no RLS policy for it. Deployment of this code cannot persist a quote by itself.

## Prerequisites before provisioning any execution role

1. Independently authenticate a customer and verify current ownership of a complete shipping address; canonicalize and digest the full destination under a reviewed scheme.
2. Resolve each local variant to the exact, synchronized private Printful product/variant mappings, confirm print assets/production feasibility and verify supplier inventory/availability per order, not fictional warehouse stock.
3. Select authoritative, *approved and active* retail prices with correct currency, line taxes and full-cart provider shipping option. Price/tax amounts and shipping option must be verified from trusted server/provider evidence. Never trust browser amounts, destination or provider IDs.
4. Design an idempotency replay policy with a stored evidence fingerprint and explicit conflict/retry semantics. A unique customer/idempotency key alone does not prove retry equivalence.
5. Provision a dedicated least-privileged login, review RLS policy/role grants and audited DB transaction scope, and integrate only through a separately authenticated worker. Verify expiry and supplier availability at payment handoff.
6. Build payment confirmation, irreversible/uncertain outcome handling, provider fulfilment creation and reconciliation, refunds and cancellations before changing publication/variant-activation locks.

A successfully persisted POD snapshot would still be **non-payable and non-fulfillable** due to permanent database CHECK constraints from PR #369. This feature does not relax them.
