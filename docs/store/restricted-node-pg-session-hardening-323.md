# PR #323 — restricted node-postgres session hardening

Extends PR #322's real authenticated `pg.Client` integration regression in disposable PostgreSQL 15/17, pinned to the local fixture. Assertions deny direct role-table UPDATE and `SET SESSION AUTHORIZATION postgres`, verify identity remains the restricted login, inspect the real PostgreSQL `statement_timeout` configuration, and force SQLSTATE 57014 on a slow query using a 150 ms server timeout. A subsequent eligibility query proves the session remains usable following the cancellation.

All security assertions operate solely on synthetic test identities and credentials. This is **not** a production or staging connection, migration, new grant, runtime activation, or assertion of TLS correctness (PR #321 covers local node-postgres TLS handshake separately). Payment and Printful execution remain disabled. Keep draft pending CI.
