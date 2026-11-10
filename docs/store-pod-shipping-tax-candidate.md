# POD quote candidate — shipping and tax calculation boundary (PR #376)

This is a **pure, disconnected calculation helper**, not an executable customer checkout, not a tax service and not permission to persist a quote. It adds no database role, grant, endpoint, payment, Printful order API call, or inventory mutation.

The helper takes an independently resolved cart (PR #375), an already obtained Printful full-cart shipping response (PR #370), a selected shipping option and separate approved tax evidence. It checks the selected shipping option is unique within the provider response, that line counts and currencies match, that the observed shipping quote and tax evidence are not older than two minutes, and that exact two-decimal amounts yield a bounded total using integer minor units.

The `digestPodTaxBasis` helper deterministically binds the tax evidence to currency, destination and the exact cart lines, without claiming to authenticate the evidence's author. The tax evidence's `MERCHANT_APPROVED_TAX_ENGINE` marker is **only a shape marker**: it is not a digital signature, legal tax ruling, or source authentication. A future independent worker must verify the tax provider and its evidence before constructing this object. No arbitrary zero-tax default is allowed.

The result is a `PodQuoteCandidate` with `paymentReady:false` and `fulfillmentReady:false`. It intentionally omits customer identity, the full customer-address digest, persisted idempotency context and the restricted writer's `TrustedPodQuoteEvidence` shape. It cannot be directly passed to the PR #374 writer.

Before persistence or payment, the isolated worker must: reverify customer authentication and address ownership, verify Printful mapping and production readiness, obtain shipping for the complete live cart/address, authenticate tax evidence and validate applicable tax law, bind the provider request to this exact cart rather than relying on line count, approve prices, generate canonical full-address and replay digests, and prove safe failure/retry behavior. Keep both publication/variant-activation locks and all payment/fulfilment feature flags off.
