# PR #316 — Disposable stable-reader privilege audit

Extends the disposable PostgreSQL 15/17 integration suite for the stable-name prototype `private.evo_store_operator_eligible_for_reconciliation(uuid)`.

Database-catalog assertions verify the function is SECURITY DEFINER owned by a dedicated NOLOGIN role with empty search_path; the caller is a separate LOGIN without superuser/BYPASSRLS/role-administration/database-creation attributes or membership in its owner. The login can EXECUTE the single boolean eligibility function but has no direct SELECT on public.roles or public.user_roles. The owner has limited SELECT with two explicit RLS SELECT policies. A real login session is denied schema CREATE and direct roles SELECT; prior PR #315 tests also deny payment-table SELECT and role impersonation.

**Boundaries:** This only audits the named function and its tested privileges. It does not constitute a comprehensive assertion over every payment function signature or guarantee that future grants cannot expand access. The fixture uses a disposable password and must never be deployed. The app remains configured for the disposable 309 function; no production Supabase migration, real staging credentials, TLS deployment, executor grants, payment capture or Printful activation.
