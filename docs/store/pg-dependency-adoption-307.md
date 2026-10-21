# PR #307 — Adopt validated PostgreSQL driver dependency

PR #306 generated and clean-installed pinned `pg@8.16.3` in GitHub Actions run `39586858086`, uploading two manifest files as artifact `store-pg-8-16-3-lockfile-candidate` (artifact ID `12340535801`). This PR includes a deliberately narrow import workflow that downloads that *specific* previously verified artifact into a temporary GitHub runner directory, verifies existing dependency sets are otherwise unchanged and the driver has exact lockfile entries and package integrity metadata, then runs `npm ci`, TypeScript checking and application tests.

If all checks pass and GitHub grants write permission for this same-repository PR, the job commits **only** `package.json` and `package-lock.json` to `deps/store-pg-lockfile-307`. No GitHub release, registry publishing, production database connection, or other application files are changed. **Do not merge unless the two manifest files actually appear under the PR's changed files and checks on the updated branch have been reviewed.**

The application must not construct a production client or enable any Store worker until a dedicated role/function, TLS certificate verification, credential isolation, separate trusted issuer, live human authentication, and final correlation privilege review are complete. The existing owner-only Store correlation function relies on a spoofable `auth.uid()` session claim and must not be granted to a restricted login.

No production Supabase migration, DB grant, Razorpay Orders POST/capture or Printful fulfillment.
