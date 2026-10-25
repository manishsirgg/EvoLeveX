# Evo Store isolated staging environment — operator setup

**Current blocker:** only the existing EvoLeveX Supabase project was visible in the connected account on 2026-10-25. No separate staging instance was verified. Do **not** run the provisioning SQL or worker readiness scripts on that project.

1. Create a **new, separate Supabase project** for staging, with its own project ref, database credentials and ideally an isolated secret store. Never copy production customer data, payment secrets or auth tokens.
2. Import reviewed schema/migrations with synthetic catalog/orders only; verify extension and migration compatibility and database baseline. No live payment or Printful API keys.
3. Confirm staging project ref differs from production and the direct database host equals `db.<staging-ref>.supabase.co`; use `assertIndependentStoreStagingTarget` before any privileged staging operation. Other Supabase connection endpoints require an independently reviewed hostname policy.
4. Review role-provisioning template `docs/store/sql/staging-dispatch-role-provisioning-346.sql` with staging DBA. These SQL templates are **not automatically deployed**. Provision a strong SCRAM credential via an approved secret manager; review `docs/store/sql/staging-dispatch-login-activation-347.sql` separately.
5. Run the read-only role audit `node scripts/store-staging-role-audit.mjs`, then worker readiness `node scripts/store-staging-worker-readiness.mjs` only from an isolated staging host with explicitly set admission flags and verified CA. Do not commit environment files, connection strings or certificate private keys.
6. Verify no overprivileged worker rights, no payments, and no provider POST occurred. Controlled provider sandbox testing and ambiguous-result recovery require separate approval and evidence.

**Do not enable Vercel checkout/payment flags, create live Razorpay orders or run Printful fulfilment during this setup.** Merge of this PR only adds a pure guard and documentation; it does not provision staging.
