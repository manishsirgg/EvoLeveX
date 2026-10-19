# PR #292 — Disposable owner-orchestrated ticket + real Store transaction

Extends the existing PostgreSQL 15/17 real Store operator-gate integration suite. Two 256-bit test tickets are issued by the separate disposable issuer role and stored hashed in `test_real_291.tickets`. In a **single owner-controlled SQL transaction**, the fixture updates a ticket to consumed and invokes the **actual owner-only** `private.execute_evo_store_correlation_atomically`.

- Intentionally inconsistent provider amount rejects real correlation; the ticket update and real nonce reservation must both roll back.
- Valid synthetic evidence commits the ticket update, real nonce reservation, and real provider-attempt transition.
- Existing negative operator authorization, nonce replay and correlation audit assertions remain in place.
- Existing restricted worker cannot invoke real correlation or access tickets directly.

## Security boundary

This is **not** a worker execution pathway: the disposable test DB **owner** operates the transaction, updates the ticket and supplies the operator claim; a separately authenticated issuer produces only test tickets. It does not prove issuer-to-human authentication, independent provider attestation, or SQL-based worker authorization. Production's owner-only correlation function and always-false proof gate stay unchanged. In particular, **do not grant restricted worker EXECUTE on the existing function** based on this test, since `auth.uid()` is a spoofable PostgreSQL session claim.

No production migration or privilege changes. No Razorpay Orders POST, capture, or Printful fulfillment.
