# Evo Store: database deployment drift and recovery

## Observed discrepancy (9 November 2026)

GitHub PRs #363, #364, #367 and #369 were merged, but a read-only inspection of the connected EvoLeveX Supabase project found **none** of the following:

- `public.seed_evo_store_inactive_draft_prices(uuid,text,jsonb)`
- `public.seed_evo_store_verified_draft_weights(uuid,jsonb)`
- `public.is_evo_store_printful_mapped_product(uuid)`
- `private.evo_store_pod_quote_snapshots`
- `private.evo_store_pod_quote_lines`

A successful GitHub merge or Vercel build does **not** imply a Supabase SQL migration was applied. Do not infer a deployment's DB state from the repo history.

## How to audit

Use a dedicated, least-privileged database identity with `CONNECT` and metadata inspection privileges. Provide its TLS PostgreSQL URL as `STORE_MIGRATION_AUDIT_DATABASE_URL`. When required, supply the trusted CA certificate text as `STORE_MIGRATION_AUDIT_CA_PEM`. Never put these in `NEXT_PUBLIC_*` or commit a secret.

Run `npm run audit:store:database`. Each required function, table and active trigger shows PASS/MISSING. The command uses `BEGIN READ ONLY`, creates nothing, executes no provider request, prints no database URL and returns exit code 1 on missing objects or connection errors.

This command is a **deployment audit**, not a migration runner. It should be executed after SQL deployment and before any Store checkout feature flags are enabled.

## Recovery sequence

1. Confirm the correct production Supabase project ID and a current database backup. Inspect migration history and deployed object definitions before applying anything. SQL migrations are not automatically applied by Vercel.
2. Review all migrations since the last **verified** database baseline, not merely the four listed above. Their dependencies and order matter.
3. Apply reviewed pending SQL in version order with the normal Supabase migration workflow; never blindly replay unknown migrations, assume missing migration-history rows prove missing objects, or overwrite production table definitions.
4. Re-run the read-only deployment audit. Independently verify publication locks, variant activation locks, RLS/grants, checkout restrictions and no fictional Printful inventory.
5. Keep Razorpay dispatch, POD publication, customer checkout and Printful fulfilment off. The existence of POD quote tables does not constitute a payment-ready checkout, and no writer grants exist for those tables.

## Next engineering milestone

After the required schema actually exists, implement a restricted, transactionally authorized POD quote writer that verifies customer address ownership, supplier mappings, production approval, full-cart shipping, taxes, exact totals and expiry. Do not enable charging or fulfilment without the payment lifecycle and reconciliation tests.
