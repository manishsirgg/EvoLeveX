# POD full-cart shipping request binding — PR #377

The initial quote candidate in PR #376 checked only the provider-returned line count. Two carts can have the same number of lines while containing different catalog variants, quantities and destination. **Line-count equality is not a sufficient correlation check.**

This PR adds a server-only adapter that validates every local variant to catalog variant and quantity pairing, canonicalizes the complete recipient and sorted provider items, then obtains **one** Printful shipping-rate request through the existing disabled-by-default provider adapter. It records an internal SHA-256 correlation digest for that request and the returned option details, plus a timestamp. A wrapper verifies the cart, destination, currency, options and freshness before delegating to the existing non-payable shipping/tax calculator.

The SHA-256 hashes are **not signatures**, cryptographic provider attestation, or proof that a request was made. An external caller can fabricate an object with matching digest values. Keep the evidence inside the same isolated, authorized worker that made the Printful request. No browser, customer route or provider webhook may supply a `BoundPodShippingEvidence` object. The helper does not verify independent tax authority or merchant production approval.

## Security boundary

- No new database migrations, credentials, grants, RLS policy, customer checkout API, quote database writes, inventory reservations or Printful orders.
- Existing `STORE_POD_FULL_CART_SHIPPING_ENABLED` remains off unless separately authorized; no change to the environment configuration.
- Existing Printful publication, stock and payment locks remain in force.
- The calculated candidate remains `paymentReady:false` and `fulfillmentReady:false`.
- Future executable worker must verify authenticated customer identity, saved-address ownership, current mapping and production readiness, provider request/response provenance, independent tax evidence and quote idempotency before any restricted persistence.

The next milestone is an independently verifiable authority boundary, not simply adding a customer-facing payment button.
