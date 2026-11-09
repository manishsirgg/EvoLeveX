# Evo Store POD checkout — isolated quote foundation (PR #369)

The existing warehouse checkout uses quantity_on_hand and inventory reservations. Printful print-on-demand **must not** use those rows as an artificial stock balance.

The private tables `evo_store_pod_quote_snapshots` and `evo_store_pod_quote_lines` store **no records by this migration**, expose **no grants**, create **no customer endpoint**, and have no payment or fulfilment execution capability.

## What a later independently reviewed worker must implement

1. Authenticate the customer, load their actual address under its ownership policy, verify merchant shipping geography, and hash the normalized destination using a reviewed canonical encoding. Do not use client amounts or untrusted mapping identifiers.
2. Load complete product/variant Printful mappings under a transaction, require synced/approved production metadata, and verify a fresh catalog identity. Require explicit production authorization; a valid SKU and artwork file ID alone are not enough.
3. Price every line in an exact common currency, obtain a **fresh shipping rate** for the complete cart/destination, and verify tax and delivery obligations. Different provider currencies and unavailable destinations must fail closed.
4. Record an all-lines atomic quote with stable idempotency, a short expiry and appropriate constraints/triggers to **prove** sum(line_subtotal) = subtotal and to bind stored sync/catalog IDs to private mapping rows. Snapshot rows must be treated as untrusted until these validations exist.
5. Design a distinct POD order-attempt state machine, retries/reconciliation, cancellation and refund lifecycle, and authorized provider fulfilment dispatch. Reverify quote expiry and supplier feasibility before payment; only confirmed payment may advance fulfilment.
6. Review tenant privileges and audit trail; provision only a minimal dedicated role. No blanket service-role path or client grants. Integrate customer payment only after webhook/status tests and all production acceptance tests.

## Prohibited shortcuts

- No `quantity_on_hand = 9999` or simulated warehouse reservations.
- No bypass of the Printful product publication/variant-activation locks.
- No automatic transition from an advisory quote to payment-ready or fulfilment-ready.
- No user-entered provider IDs or shipping rates.
- No production order submission from the web request that gets a shipping quote.
