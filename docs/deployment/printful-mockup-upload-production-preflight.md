# Printful mockup production preflight — PR #191

**Status: NOT AUTHORIZED FOR PRODUCTION UPLOAD.** This is a read-only audit and a regression fix, not a launch approval.

## What code inspection establishes
- Server action `uploadApprovedPrintfulMockup` calls `requireAdmin()` and gates **before provider fetch / DB writes** on `PRINTFUL_MEDIA_UPLOAD_ENABLED === 'true'`.
- The input is restricted to the one imported Printful product and three approved front mockup file IDs.
- It fetches/decodes approved provider PNG before reservation; derives canonical local Storage path; acquires a one-owner database claim; uploads using `upsert:false`; downloads and compares SHA-256; calls token-fenced finalization.
- Any error after claim acquisition returns `RECONCILIATION_REQUIRED` without releasing the claim or deleting possibly existing Storage objects. This prevents blind retries but requires an explicit manual recovery process.
- The claim token check previously used double escaping inside a regex literal and could reject valid tokens. PR #191 fixes this and adds a regression test.

## What code inspection does NOT establish
- Production Storage bucket, authenticated policy rules, bucket access, actual upload/download permissions, size/format limits, and full real-session behavior have **not** been independently verified by this document.
- The claim does **not** gate arbitrary direct Storage HTTP requests made outside the server action. Storage RLS must be assessed independently; the action's feature flag does not shut down direct Storage endpoints.
- There is no automated safe takeover of abandoned claims, no automated reconciliation of pending objects, and no guaranteed transactional atomicity between HTTP upload and SQL completion.
- No authorization to expose the action in the UI, enable flags, or publish/activate POD variants has been granted.

## Read-only production preflight checklist
1. Verify `PRINTFUL_MEDIA_UPLOAD_ENABLED` is **unset or false** for Production and relevant Preview environments. Keep `PRINTFUL_IMPORT_ENABLED=false`.
2. Review `storage.buckets` and `pg_policies` for `storage.objects` via the production SQL editor **read-only**. Confirm upload/download privileges for the same authenticated admin session used by Next.js server actions; never assume role checks on the RPC also protect direct Storage API calls.
3. Review the imported product draft status, local category, image records, and pending claims / ingestion ledger without modifying them.
4. Verify the four-argument `complete_evo_store_printful_mockup(uuid,bigint,text,uuid)` executes only for authenticated role; verify the three-argument overload is revoked.
5. Review `inspectPrintfulMockupRecovery` read-only for each approved mockup. A claim with ambiguous status must remain blocked pending documented, operator-reviewed reconciliation.
6. In a **disposable local** environment, repeat a full authenticated end-to-end action test with real Storage HTTP and verify non-admin denial, claim exclusivity, SHA-256 integrity, token ownership, and recovery diagnostics. Existing tests cover components but not a verified production session.
7. Seek explicit launch authorization before toggling any feature flag; authorize at most one controlled mockup first, with measured rollback/reconciliation steps.

## Deployment scope
No new database migration in PR #191. No new upload button or public route. No production data mutation or Printful API write is performed by this change.
