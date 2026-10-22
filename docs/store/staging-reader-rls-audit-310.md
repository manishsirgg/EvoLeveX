# PR #310 — Disposable role-reader RLS and privilege audit

Extends the disposable PostgreSQL 15/17 Store integration suite for PR #309's no-login function owner and restricted reader.

The tests assert that neither owner nor login has superuser, BYPASSRLS, CREATEROLE or CREATEDB; the reader is not a member of the owner; the eligibility function is SECURITY DEFINER with an empty search_path and the expected owner; anon, authenticated and service_role cannot execute it; the reader cannot create schema objects, change function security, or UPDATE role assignments. A forged request.jwt.claim.sub still cannot change the explicit UUID authorization argument.

The function owner continues to use scoped SELECT policies on real public.user_roles and public.roles. Prior integration tests preserve admin/editor distinctions, revocation, restoration, and direct payment-table access denial. These database-account controls are **necessary, not sufficient** for live deployment: a SECURITY DEFINER review must also cover object ownership, RLS policy alterations, role membership, connection/session GUC handling, TLS identity and a proper issuer boundary.

This PR changes only disposable tests and documentation. No production Supabase migrations, SQL grants, login credentials, connections, payment/correlation execution, Razorpay initiation/capture or Printful fulfillment.
