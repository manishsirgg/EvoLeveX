# PR #289 — Real Store atomic revocation boundary

Adds a PostgreSQL 15/17 disposable integration regression test against the **actual** owner-only `private.execute_evo_store_correlation_atomically` function. Before its successful correlation test, an administrator's real `public.user_roles` membership is revoked. The function must reject execution and leave both the real nonce ledger and provider attempt unchanged. The fixture restores the administrator's role and then executes the existing successful atomic correlation assertions.

This does **not** connect a restricted worker, issue a trusted ticket, or establish authenticated operator identity at the database boundary. The test uses database-owner execution and a mutable session JWT claim: these are inadequate for live worker authorization. Treat the result as a concrete revocation regression test, not completion of the wider worker/ticket integration milestone.

No production SQL migration, role GRANT, live payment initiation/capture or Printful fulfillment.
