# Archived inventory guard compatibility repair

The original `20261005040000` migration installs the inventory archive guard
and its BEFORE INSERT OR UPDATE OR DELETE row trigger. Phase 2J-B replaces only
its function, allowing an exact reservation decrement (updated_at excepted),
without restoring a missing trigger. B alone therefore cannot repair this drift.

`20261009000000_evo_store_archived_inventory_guard_compatibility.sql` requires
that exact Phase 2J-B body, SECURITY DEFINER, empty search_path, postgres ownership
and no PUBLIC/anon/authenticated execution. The MD5 equality check identifies the
reviewed body; it is not an adversarial cryptographic security boundary. Even
formatting changes require an explicitly reviewed forward migration. Function
owner/superuser administrators remain trusted; this does not defend against them.

The migration is one atomic DO statement. It takes SHARE ROW EXCLUSIVE on inventory
before inspection, restores only absent wiring, and fails on incompatible wiring.
Existing canonical wiring is preserved, including its OID. Disabled, replica-only,
always-enabled, filtered, column-specific, wrong-function/table/event/timing/level,
argument-bearing or constraint triggers are rejected. It changes no guard body,
rows, grants, RLS or constraints. Normal full replay and drifted replay are tested.

## Production gates and ordering

Production SQL execution and scheduling are separate approvals. Disposable CI does
not establish production compatibility or authorization. Confirm the production
project, all catalog/profile/address column and key definitions, inventory checks,
readiness/archive/update triggers, private helpers, owner and role permissions,
and absence/classification of partial checkout objects. Inspect the inventory
adjustment RPC and customer DML grants independently; this migration does not fix
unrelated omissions. Confirm the existing product/variant/archive schema matches B.

Deploy in order:

1. A: `20261006000000_evo_store_checkout_reservation_foundation.sql`
2. B: `20261006010000_evo_store_transactional_inventory_reservations.sql`
3. C: `20261008125840_evo_store_checkout_expiry_worker.sql`
4. D: `20261009000000_evo_store_archived_inventory_guard_compatibility.sql`

B immediately grants authenticated reservation RPC execution. The controlled
window must prevent customer RPC calls and inventory writes until D commits and
verification passes; having no UI is insufficient. If this cannot be guaranteed,
STOP and separately review an atomic A–D deployment transaction or prerequisite
repair strategy. Do not expose an uncontrolled B-to-D interval.

Use a trusted postgres migration owner and explicit transaction boundaries for
complete files, never individual statements. Set reviewed deployment timeouts;
A locks/validates existing prices and D's table lock blocks inventory writers and
competing trigger DDL. Long-running transactions can delay either. Preserve the
existing parent-first application lock order; direct privileged inventory DML can
still acquire inventory before parent locks, so existing deadlock/retry risks remain.

Record reviewed file checksums, operator, results and effective schema; do not
fabricate missing migration history or blindly replay older migrations. Capture
pre/post aggregate inventory/ledger evidence, accounting for concurrent activity.
Read-only verification must establish trigger identity, tgtype=31, tgenabled=O,
no WHEN/arguments/column filter, function body/security/ownership/ACL, checkout
RLS/RPC permissions and unchanged stock/ledger. Never invoke production checkout
RPCs as a verification shortcut. Keep scheduling disabled.

A failed D statement rolls back its own changes; an aborted enclosing transaction
rolls back the entire transaction. Stop, inspect the exact error and schema, and
repair forward under review. Do not drop incompatible triggers or inventory data,
reinstall the strict pre-B body, or destroy checkout snapshots/holds to recover.
Already committed A/B/C remain committed if deployed in separate transactions;
maintain the controlled window until repair succeeds. The trusted postgres owner
requirement intentionally rejects alternate migration-owner arrangements.
