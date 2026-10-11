# Printful decorated-product cost estimation — read-only contract review

Status: **documentation/contract assessment only**, 2026-10-11. No network calls, no permission changes, no migrations, no orders.

## What is independently documented

Official reference: https://developers.printful.com/docs/ (Orders API, "Estimate order costs", `POST /orders/estimate-costs`).

- Printful describes an order-estimation endpoint that calculates item, print, shipping, and tax costs **without creating an order**.
- Request requires `recipient` and `items`; optional settings include `shipping`. The recipient is an order-style address, NOT the sparse country-only shipping-rates example.
- Estimated cost response may depend on correct Printful synchronized product/variant IDs, artwork/print files, placement, and provider configuration. **Do not reuse the catalog variant ID as if it were a synchronized variant ID.**
- Order cost calculation can be delayed for some print configurations. A response or error cannot be assumed to be a finalized, authoritative landed cost.
- The API also documents `POST /orders` as **order creation** (even without auto-confirm). That endpoint is OUT OF SCOPE.
- The shipping-rates API explicitly warns that its results can differ from order-cost estimation because of store shipping settings. The observed India USD 12.49 / 12.58 shipping example is **not** a decorated-garment production quote.

V2 documentation: https://developers.printful.com/docs/v2-preview/ (Order estimation tasks).
- `POST /v2/order-estimation-tasks` initiates a **non-order estimation task**.
- `GET /v2/order-estimation-tasks?id=...` polls it; statuses include pending/failed/completed; cost and retail fields are distinct.
- V2 request semantics, IDs, output shape, asynchronous lifecycle, and token authorization should be investigated separately from the legacy endpoint. We must not accidentally combine V1 and V2 payload shapes.

## Established EvoLeveX facts

- Product: imported Printful synced T-shirt `479728769`; corresponding Evo Store product `1dc06ef8-9a2e-419f-9bc3-d3ec06c476e0`.
- 18 size/color variations currently inactive; product remains Draft.
- Three approved verified product gallery PNGs are **mockups, not automatically valid production print files**.
- Existing token scope inspection observed `sync_products/read` and `file_library/read`. A successful `POST /shipping/rates` for Black/S catalog variant `4866` does **not** prove authorization for `POST /orders/estimate-costs`.
- Historical catalog observations: S–XL 16.91, 2XL 18.91, 3XL 20.91 with currency **not supplied** in that response. The worksheet cannot establish they are USD merely because a separate India quote used USD.
- Our shipping probe is locked OFF and must remain OFF.

## Explicit gates before any cost-estimation API probe

1. Identify exact order-estimation endpoint/version and required scopes from up-to-date Printful documentation or support, and review token least-privilege risk. **Do not broaden the live token without approval.**
2. Confirm which identifier Printful requires for the existing synchronized product's Black/S item. Distinguish catalog variant `4866`, Printful sync product `479728769`, and its sync variant IDs. Validate template/artwork placement, especially any front decoration; mockup image paths must not be sent as print artwork.
3. Build strictly offline request-schema validation with tests for malformed/mismatched product identifiers, missing recipient address, missing artwork data, wrong currency, and arbitrary destinations.
4. Use a synthetic test recipient only after checking API requirements. Do not send real customer personal data during development.
5. If a probe is authorized separately, isolate it behind a new default-off server authorization flag with privileged administrator verification, one attempt, no automatic retries, no order or checkout write path, bounded response, sanitized errors.
6. Confirm API behavior with an approved diagnostic response and explicitly disable the flag again before updating pricing. Any response that is pending or contains unavailable/partial costs remains incomplete.
7. Require explicit currency, full decoration costs, destination-specific shipping, taxes/duties, platform fees, and margin evidence before changing retail prices. Payment/checkout/fulfillment remain disabled.

## Engineering decision

**Do not implement a production cost-estimation API caller yet.** The endpoint exists, but order-item identity/artwork requirements and token authorization are not verified for our synced T-shirt. Next safe implementation can be an offline cost-estimate contract/test harness after these details are established.

No code should be permitted to call `POST /orders`, `POST /orders/{id}/confirm`, or `POST /v2/orders` as part of this analysis.
