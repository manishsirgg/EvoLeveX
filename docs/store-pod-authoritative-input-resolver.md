# POD authoritative input resolver (PR #375)

This is a read-only server-only capability, **not a new customer checkout**. It has no HTTP handler, function grant, database migration, direct credentials, quote write or Printful order call.

A future independently authenticated worker may supply a customer ID, saved address ID, requested local variant IDs/quantities, currency and an already-connected restricted database session. The resolver requires `current_user` AND `session_user` to be the exact dedicated identity `evo_store_pod_quote_reader` (not provisioned by this PR).

It verifies the saved address belongs to that customer, matches every requested local variant to its own synchronized Printful product and variant mapping, requires Printful store identity 18878485 with sync explicitly enabled, verifies positive authoritative active retail prices in the requested currency, and requires a published/active physical product/variant with positive recorded weight. It passes the full resolved cart through the existing Printful shipping request validation contract.

These strict publication and activation requirements deliberately prevent the current draft, publication-locked POD catalog from being treated as orderable. The resolver is **not connected to the quote writer** and does not authorize payment, shipping, tax, fulfilment, or any product publication changes.

Before implementing an authorized quote-preparation worker: independently authenticate the customer and bind supplied IDs to that identity; require reviewed production artwork/availability; use the full customer destination to obtain a fresh provider full-cart shipping rate; calculate applicable tax and total in one verified currency; store a canonical destination digest and replay evidence fingerprint; reconcile provider uncertainty and final payment/fulfilment lifecycle. Design the minimum read-only DB role, its RLS policy and privileges and audit them separately before deployment. Do not grant broad access to private maps or customer addresses as a shortcut.
