# PR #283 — Trusted ticket issuance composition (staging only)

This module authenticates an operator with the existing Supabase Auth verifier, checks live eligibility, validates the designated correlation attempt through a separately injected trusted provider, and **revalidates the same bound session immediately before calling an injected issuer**. Every attempt receives a new cryptographically random 256-bit ticket, with a 30-second requested expiry. The operator is derived only from verification, never from caller-supplied operator metadata.

**Critical integration gap:** PR #282 disposable SQL experiment stores UUID tickets, while this module emits 64 hex characters (256 bits). They are **not yet compatible**. The future reviewed database design must consistently use a secure fixed-length token or its digest without truncation, independently authenticate the issuer, and enforce the expiry using database time rather than trusting an application-supplied expiresAt.

**Not yet guaranteed:** issuer SQL login separation, issuance audit, privilege separation, atomic live role-table and attempt-state locks, binding provider evidence, secure delivery to consumer, ticket theft resistance, replay concurrency, and trusted wall-clock authority. This callback-based module makes **no database writes without a provided issuer** and is not connected to any runtime or public route.

Do not grant SQL EXECUTE or change the always-false production proof gate. Razorpay Orders POST, capture and Printful remain disabled.
