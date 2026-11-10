# POD signed quote-intent proof — PR #379

This PR adds a pure Ed25519 proof format for **internal, short-lived POD quote intent**. It is not an API route, worker, permission grant, payment authorization, Printful order submission, or source authentication for tax or supplier availability.

A future separately authenticated quote-preparation worker may create a proof only after independently validating quote evidence. The signed payload binds a specific worker ID, customer ID, idempotency key, fresh nonce, canonical digest of **all** quote evidence, issuer/audience, issued-at time, and expiry no more than 60 seconds after issue.

The canonical digest includes store ID, currency, destination digest, full mapped catalog/sync/local variant identities, SKUs, prices, quantities, subtotal, shipping, tax, provider shipping option and observation timestamp, plus quote expiration. Quote lines are sorted by variant ID for stable comparisons. Verification requires a trusted Ed25519 public key, exact expected worker identity and expected nonce, checks signature and expiry, revalidates the quote contract, and compares the complete intent digest using timing-safe equality.

The proof does **not** consume its nonce. Never treat an otherwise valid signature as proof that a nonce is unique or that a quote may be persisted, paid or fulfilled. A future isolated worker needs its own durable nonce/idempotency consumption and transaction-level replay protection, verified customer authentication and saved-address ownership, independent provider/tax/production evidence validation, and dedicated narrowly scoped DB privileges before invoking the restricted writer.

There are **no new environment variables, secrets, database migrations, direct grants, customer checkout actions, inventory mutations or Printful/Razorpay dispatches**. The existing POD quote tables remain non-payable and non-fulfillable.
