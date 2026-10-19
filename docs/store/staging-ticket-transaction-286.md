# PR #286 — Staging ticket-bound correlation composition

This PR connects three **existing, non-deployed** application contracts into one dependency-injected staging workflow: independently verified Supabase operator and live role, attempt authorization, 256-bit ticket issuance, reauthentication of the bound operator, freshness/Ed25519 proof and attempt reread, and an abstract `consumeTicketAndCommitAtomically` dependency.

The final dependency is intentionally **not implemented**. Its eventual database implementation must atomically validate/consume the digest-only ticket using distinct authenticated issuer/worker DB principals, lock and recheck real Store role memberships and attempt state, consume the existing nonce and record correlation. This orchestration does not guarantee SQL-level atomicity or independently attest the operator at the database boundary.

Automated tests validate the handoff and negative paths for attempt denial, mid-workflow role revocation, stale attempt and failed issuer. Existing disposable PG15/PG17 tests separately cover issuer/consumer privilege separation and real-role preflight; they are **not equivalent** to end-to-end SQL integration. This PR is application-only and does not change any production SQL or database roles.

Production proof gate stays always FALSE; privileged DB executor is disconnected. Razorpay Orders POST, payment capture and Printful fulfillment remain disabled.
