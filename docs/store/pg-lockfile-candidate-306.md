# PR #306 — Reproducible PostgreSQL driver dependency candidate

PR #305 successfully verified a real Node.js `pg` driver in disposable PostgreSQL 15/17 CI, but installed it ephemerally without modifying the application dependency lockfile. The production application must not depend on this ephemeral installation.

PR #306 introduces a **reviewable candidate-generation workflow**, without modifying `package.json` or `package-lock.json`:

1. Copies both manifests into the GitHub runner's disposable temporary directory.
2. Runs `npm install --package-lock-only --save-exact pg@8.16.3` there.
3. Validates root manifest and lock entries, package version, and HTTPS tarball integrity metadata.
4. Performs a clean `npm ci` using the candidate lockfile and checks the installed driver version.
5. Checks that the repository manifests were not modified.
6. Uploads the two candidate manifests as a **short-lived GitHub Actions artifact** for explicit review and a later separate commit.

## Remaining prerequisite for live integration

The candidate is **not automatically committed or deployed**. Once CI passes, the generated `package.json` and `package-lock.json` must be reviewed and committed together in a follow-up PR, followed by production build/test checks and a dependency/security review. Before any runtime connection: independently verify database credentials, private function/role privileges, CA/TLS verification, safe timeouts, connection handling, Supabase user identity binding, and the worker execution boundary.

No production database migration, `pg` runtime import, server route, secret, role grant, Razorpay Orders POST/capture, or Printful fulfillment. The owner-only correlation function and deny-all proof gate remain unchanged.
