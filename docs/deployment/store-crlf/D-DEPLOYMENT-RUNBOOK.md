# EvoLeveX atomic Store database deployment and recovery

This package supersedes the failed strict-LF deployment package. Production
execution is NOT performed by its generator or tests. Target project:
`qizgkxgiannzmzsrchot`. No scheduler activation is included.

## Status and evidence

NOT READY for execution until every gate below has been verified and execution
is explicitly authorized. See BUILD-AND-VALIDATION.txt for the source commit and
final disposable CI results. Migration and artifact manifests pin the exact bytes.

The first four original migration files are unchanged. The fifth deployment step
is NEW `20261009010000_evo_store_archived_inventory_guard_crlf_compatibility.sql`,
a forward-only successor to the unchanged `20261009000000` file. It SUBSTITUTES for
that file in this SQL Editor deployment, rather than running after it. The old
file would fail before an appended fix could run. Normal repository LF migration
replay may execute both in chronological order; never edit migration history.

The successor validates MD5(replace(prosrc, chr(13)||chr(10), chr(10))) against
`b1ac65d9a274ab4c40a6451e78d790cb`. Only CRLF pairs normalize for comparison. It does
not rewrite the function, normalize arbitrary whitespace or change business logic.
It preserves all original ownership, definer, kind, return type, exact empty
search_path, EXECUTE-denial and canonical trigger-wiring checks.

Full LF and CRLF transactions, successful COMMIT, intentional rollback at each
step, security/wiring negative tests, archived decrements and unchanged stock /
ledger invariants are validated on disposable PostgreSQL 15 and 17. Original
strict-LF diagnostics and all existing separate-session concurrency tests remain.
CI establishes rehearsal behavior, not equivalence of production helper bodies.

## Remaining gates (STOP if any are unresolved)

1. Confirm the SQL Editor is for qizgkxgiannzmzsrchot. Database name postgres
   does NOT identify the Supabase project. Use dashboard project identity.
2. Select the trusted postgres execution role. The successor requires guard owner postgres;
   all definer functions must be created under this trusted role. No customer role.
3. Run B (read-only), retain every result set, and review against supplied preflight.
   If the Editor shows only the final result, select/run individual SELECTs in a
   fresh read-only transaction; do not mistake the final COMMIT for all checks.
4. Schemas, columns, enums, price/ledger constraints and keys are reported verified;
   reconfirm the relevant results have not changed. Product/variant/price/inventory/
   movement counts, stock totals and movement totals must remain zero.
5. The adjustment RPC, archived inventory guard function/canonical trigger and
   checkout objects must be absent. Any partial object/overload or incompatible
   trigger is a STOP condition. The deployment and original trigger creation are not a generic
   idempotent deployment; never simply rerun after a successful commit.
6. Review exact stored critical helper bodies, not just their signatures/presence:
   - private.is_staff() RETURNS boolean: repository predicate reads user_roles /
     roles via auth.uid(), matching super_admin/admin/editor/moderator/support.
   - auth.uid() RETURNS uuid: trusted Supabase caller identity semantics.
   - public.set_updated_at() RETURNS trigger: expected timestamp update and RETURN
     NEW, without unexpected stock/ledger effects.
   - private.evo_store_product_readiness_error(uuid) RETURNS text: compare catalog
     foundation's publication/physical/category/image/primary/variant weight /
     inventory/active-positive-price checks.
   - private.enforce_evo_store_product_readiness() and
     private.enforce_evo_store_category_readiness() RETURNS trigger, plus their
     enabled deferred trigger wiring: compare catalog foundation.
   Staff relationships/function existence are reported verified. Exact stored
   bodies of these helpers have NOT been provided here, so equivalence remains
   an explicit unresolved execution gate. Formatting-only differences need
   semantic review; do not substitute bodies or weaken checks in this package.
   Review definitions privately; do not publish embedded secrets if any exist.
7. Confirm no customer checkout or inventory operations can begin during the
   window. B grants authenticated RPC execution; absence of UI alone is insufficient.
8. Approve 5s lock and 60s statement timeouts for this quiet, empty Store window.
   They are tested values, not a guarantee against all live lock contention.
9. Confirm production recovery access/backups and retain package checksums,
   preflight evidence, operator identity and deployment record. Do not invent
   migration-history entries to conceal missing historical migrations.

## Exact migration order in A

1. 20261005040000_evo_store_inventory_management_support.sql
2. 20261006000000_evo_store_checkout_reservation_foundation.sql
3. 20261006010000_evo_store_transactional_inventory_reservations.sql
4. 20261008125840_evo_store_checkout_expiry_worker.sql
5. 20261009010000_evo_store_archived_inventory_guard_crlf_compatibility.sql

The original migration installs strict archived protections and the staff RPC.
B replaces only the guard body with the reservation-only decrement exception.
The successor verifies the final body/security/wiring. Never run the original migration after B.

## Authorized operator execution steps

1. Confirm all gates above, execution approval and the controlled window.
2. Open Supabase Dashboard -> confirmed project -> SQL Editor, trusted postgres
   role. Use a new query, paste the COMPLETE A file, and select/run the entire
   BEGIN-to-COMMIT script once. Do not execute separate highlighted fragments.
   SQL Editor implicit behavior is not relied on: A supplies an explicit boundary.
3. Capture the success/error result and time. Expected: COMMIT succeeds; adjustment,
   checkout and expiry objects exist; existing Store rows remain empty and unchanged.
   All installed privileges become visible together at commit, avoiding a B-to-successor gap.
4. In a fresh query/session, run C (read-only), retain every result and compare with B.
   Do not invoke adjustment, creation, release or expiry RPCs as a verification test.
5. Leave cron/scheduling disabled and Store operations inactive pending review.

## Expected post-deployment results

- Three checkout/failure tables exist; RLS enabled; four owner/staff SELECT policies.
- Public signatures: adjustment(uuid,text,integer,text) RETURNS TABLE; creation
  (jsonb,text,uuid,uuid), release(uuid), expiry(integer DEFAULT 25) RETURNS jsonb.
- Public RPCs and guard: postgres owner, SECURITY DEFINER, empty search_path.
  Private invoker lifecycle helpers are intentional and must match source.
- PUBLIC/anon lack privileged RPC execution. Authenticated may call staff-gated
  adjustment and customer create/release, but cannot invoke global expiry.
  service_role may invoke expiry; B revokes its customer create/release execution.
  Owners/superusers retain administrative capability; 'service-only' excludes these
  trusted administrators rather than purporting to revoke owner authority.
- Private lifecycle helpers are not customer/service execution entrypoints. Failure
  table has no direct anon/authenticated/service_role table privileges.
- Canonical trigger appears exactly once on inventory, correct private function,
  tgtype 31, tgenabled O, no WHEN/arguments/column filter/constraint/transition tables.
- Normalized guard MD5 equals b1ac65d9a274ab4c40a6451e78d790cb (exact B body).
  Raw LF MD5: b1ac65d9a274ab4c40a6451e78d790cb (1027 bytes, zero CR).
  Raw CRLF MD5: 7386206d88a4735f318572eb29878317 (1052 bytes, 25 CR).
  Compare the normalized value; raw values differ legitimately with transport.
  This checksum is equality evidence, not an adversarial cryptographic boundary.
- Customer inventory/ledger mutation denied; authenticated checkout SELECT obeys
  RLS and direct checkout DML denied. Required constraints/indexes exist and valid.
- All five existing Store counts and totals remain zero; checkout/failure tables
  and expired-active backlog are zero; invalid inventory rows zero.

## Locking, timeout and rollback risks

A replaces/validates the existing price currency constraint under a strong lock.
The successor takes SHARE ROW EXCLUSIVE on inventory. Long-running transactions can block
both; locks remain until the outer COMMIT/ROLLBACK. lock_timeout is 5s per lock wait,
statement_timeout 60s per statement, not an overall deployment wall-clock limit.
Timeouts are SET LOCAL and expire with the transaction. SQL Editor, transport or
pool timeouts can occur independently. A lost response is an UNKNOWN outcome,
not proof of rollback. Existing privileged inventory DML can invert parent-first
locking; keep the window quiet. No active worker or scheduler is part of deployment.

On SQL error: STOP. If the same connection remains in an aborted transaction,
issue ROLLBACK only; if the connection closed before COMMIT, PostgreSQL rolls back
its uncommitted changes. Do not proceed statement-by-statement or ignore errors.
Inspect through a fresh read-only session to determine actual state. If COMMIT
outcome is uncertain, run B/C metadata checks first: all original objects absent
and original definitions/grants restored indicates rollback; all new objects
present requires full post-verification. Mixed results are a STOP/investigate
condition. Never blindly rerun A, whose CREATE statements are not idempotent.

After successful commit there is no generic destructive rollback in this package.
Use separately reviewed forward repair after capturing exact evidence. Do not drop
checkout snapshots/holds, manipulate reserved quantities, remove guards, restore
the strict pre-B function, or delete inventory/ledger rows. Keep operations and
scheduling disabled until recovery and verification are approved.

## Package integrity and incident recovery

Generate with `node scripts/prepare-store-production-package.mjs <output-directory>`
from the reviewed commit. Before opening SQL Editor, run `sha256sum -c
artifact-sha256.txt` in the package directory. Compare migration-sha256.txt to the
committed compatible manifest and original-migration-sha256.txt to the original
atomic manifest. A's boundary blocks reproduce all five selected bodies byte for
byte. Do not edit A, paste a predecessor step, or "fix" individual guard definitions.
SQL Editor may convert LF to CRLF; the comparison deliberately tolerates ONLY that
transport change. Saved source/artifact checksums remain hashes of the LF files.

The previous attempt is reported completely rolled back. Reconfirm this with B
before retrying; a historical rollback report is not permission to skip current
checks. Any unexpected partial object, changed stock or unavailable helper-body
verification is a STOP condition. After a SQL error, issue ROLLBACK on the same
connection if it remains open, then inspect via a fresh read-only connection.
After a lost response do not assume rollback or retry blindly.

No production connection, migration execution or scheduler activation is included.
