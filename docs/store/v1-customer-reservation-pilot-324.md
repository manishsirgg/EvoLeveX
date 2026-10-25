# Evo Store V1 — first customer checkout bridge (PR #324)

This PR introduces the **first feature-flagged customer-facing, unpaid reservation pilot**, connecting the existing cart review to the already implemented `/api/store/checkout/reserve` endpoint. Only authenticated users with saved addresses can attempt a server-verified reservation, and only when both `STORE_V1_RESERVATION_UI_ENABLED=true` and `STORE_RESERVATION_BRIDGE_ENABLED=true` have been expressly configured. Both flags remain unset by this PR. Checkout continues to show a disabled payment button; it cannot charge customers or create a Razorpay provider order.

Server-side address lookup is scoped to `auth.getUser()` and its `user_id`, with RLS applied. The reservation route continues to own authentication, address ownership, item quantity, price, inventory and idempotency checks. Browser-supplied monetary amounts are never trusted.

Before enabling **either** feature flag, validate the live address schema and RLS, deploy and test the checkout RPCs, check merchant shipping/tax readiness, and perform a disposable/staging reservation end-to-end. This is not the consumer payment launch. A further PR must replace this pilot with fully reconciled checkout → payment → confirmation → fulfillment, including idempotency-key persistence across retries.

This change deliberately does not touch production environment variables, SQL migrations, Razorpay payment activation or Printful fulfillment. Do not claim live Store V1 readiness simply because this PR merges.
