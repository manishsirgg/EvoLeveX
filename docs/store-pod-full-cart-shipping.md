## POD full-cart shipping: next contract boundary

PR #370 adds server-only, disabled-by-default Printful shipping-rate capability for up to 50 verified local lines / 50 total units, using **catalog variant IDs** (not synchronized IDs).

**No caller is connected.** `STORE_POD_FULL_CART_SHIPPING_ENABLED` defaults to off and is only one prerequisite; enabling it alone does not create a usable customer checkout.

A future authorized checkout preparation worker MUST:

1. Authenticate the customer, load the address under customer ownership, validate geographic deliverability and inspect live synced Printful variant mappings. Never accept catalog IDs, prices, SKUs or vendor selection from the browser.
2. Require the correct production placement/artwork, provider availability and approved operational state. A successful shipping-rate quote is **not** a supplier stock/production guarantee.
3. Resolve each cart line into a trusted `TrustedPodShippingLine` and call `quoteFullCartPodShipping` with the full destination, not a sample city.
4. Verify same-currency retail item prices, taxes and selected supplier shipping option; calculate exact totals and bind all values to customer/address/mapping and quote expiry. The private snapshot tables from PR #369 have **no writer permission** and are deliberately not populated by this module.
5. Build explicit payment and Printful order state machines, signed verification, uncertain outcome reconciliation, refund/cancellation handling and administrative auditing before unlocking POD publication.
6. Preserve the POD inventory and publication locks while these requirements are incomplete.

The shipping-rate endpoint is a POST that obtains a quote, **not** a Printful order-creation request. It makes at most one request without retry.
