# PR #293 — Independent operator identity: negative-case regression suite

Adds application tests of the existing **staging-only**, bearer-token-to-operator ticket issuance boundary. An independently verified bearer identity is authoritative; there is no trusted operator UUID from caller input. The regression scenarios assert:
- An impersonator with a valid but *different* verified user ID cannot obtain a ticket for an eligible administrator's Store attempt.
- Live administrator role revocation between initial session verification and final revalidation denies ticket issuance.
- A change of verified user ID between the two checks is denied.
- Auth-verifier outages and attempt-authorization outages fail closed, without writing tickets.

These checks exercise injected fake identity/authorization dependencies; they do NOT prove the actual Supabase Auth adapter is connected, nor that the SQL issuer binds an independently authenticated human to a ticket. The restricted database worker still lacks production correlation privileges; provider evidence and the production proof gate remain unchanged.

No database migrations, runtime activation, payment initiation/capture, or fulfillment.
