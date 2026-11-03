# Reliability and privacy fixes before demonstration

Date: 3 November 2026

The owner approved six follow-up fixes after a wider repository inspection. This change builds on the [AI output validation example](ai-meal-validation.md).

## Acceptance criteria and implementation

1. Account switching must clear the previous profile and prevent stale async responses from restoring it. The auth store now resets the profile owner on identity changes. Profile requests carry a generation check. Protected page contents remount for the new user. Supabase is the single persisted session source, and the old duplicate Zustand session is removed on startup.
2. AI quota must be reserved atomically before provider calls. A service-only PostgreSQL RPC updates a daily ledger with `INSERT ... ON CONFLICT ... WHERE attempts < 3`. RPC errors stop analysis with a localized unavailable message. Every authorized free attempt consumes a slot, including provider, validation and save failures. Deleting an AI report cannot restore quota. The day boundary is UTC, and premium users remain exempt.
3. Browser clients must not change subscription tier or write the shared food library. Migration 003 revokes browser profile creation and deletion, removes old table and column grants, then allows updates only to personal fields. The existing signup trigger creates profiles. Onboarding updates that profile instead of upserting protected fields. Food-library RLS is enabled with authenticated read access. The private quota ledger and reservation RPC are unavailable to browser roles.
4. Recovery links must lead to a working, localized password form. The `/reset-password` route checks for a recovery session, minimum length and confirmation, then calls Supabase `updateUser`. Recovery authorization is tied to the current user and cleared after success or a new login. Explicit link errors are rejected even if a different account is already signed in. Refreshing a consumed link requires requesting a new link, since recovery authorization is not persisted.
5. Private API responses must not be cached. Supabase requests use Workbox `NetworkOnly`. A service-worker activation script removes the legacy `supabase-cache`, and the app also clears it on startup and explicit logout. Static assets still support the offline app shell. Failed logout is shown as an error instead of pretending the session was removed.
6. Failed meal reads must be distinguishable from an empty day. The food hook exposes an error and retry, scopes data to the selected user and date, and ignores stale reads. The food page and dashboard hide intake totals and remaining-calorie claims while loading or after failure.

Related regression coverage also corrects the Claude test key name, verifies provider authentication headers, exercises both Claude and OpenAI branches, and checks the new 30-second provider deadline.

## Local verification

- `npm run verify`: passed, 91 frontend tests, 44 backend tests and 5 workflow-hook tests, with frontend and browser-test typechecks and backend compilation.
- `npm run build`: passed for both packages after the recovery review corrections. Existing bundle-size and stale Browserslist-data warnings remain.
- `npm run test:smoke --prefix frontend`: 7 production browser cases passed. The recovery case also passed a targeted rerun after correcting its visibility-event dispatch to match the SDK's window listener. It uses intercepted APIs and synthetic accounts, not a live Supabase project.
- Smoke builds use a separate `dist-smoke` directory, and the browser fixtures block all other external requests. This prevents ordinary builds from replacing the test bundle. This isolation was added after an exploratory run failed when two builds shared an output directory.
- `git diff --check`: passed.
- The schema, migrations 001 through 003 and SQL assertions passed using PGlite 0.5.14 installed outside the repository. Assertions cover existing-use backfill, browser role permissions, signup/profile updates, report deletion, free and premium quotas, and new UTC days. No project dependencies or lockfiles were changed for this test runtime.
- PGlite has a single database connection, so its queued reservation checks do not prove locking across connections. A separate PostgreSQL CI job now runs the same SQL assertions and ten simultaneous `psql` connections, requiring exactly three accepted reservations. That CI job has not been observed locally because Docker is installed but its daemon is not running.

The new browser smoke suite is distinct from the existing real-Supabase E2E suite. Successful synthetic browser checks do not establish email delivery, hosted RLS configuration, real provider accuracy or live deployment behavior.

## Independent review

A fresh read-only reviewer found one P2 issue in the first recovery implementation: an expired link could retain an existing account's session and show a password form for that account. The implementation now requires `PASSWORD_RECOVERY` authorization for the current user and rejects callback errors. Browser regression cases cover an expired link while signed into another account and an error fragment added on the same reset page.

A follow-up review caught another P2: Supabase may emit `SIGNED_IN` when a tab regains focus, which must not invalidate a recovery session. Recovery authorization now survives same-session reconfirmation and token refresh, while explicit login and identity/session changes clear it. Store tests cover these transitions, and the browser recovery flow dispatches visibility events before completing the password change.

The final focused re-review confirmed both P2 findings resolved and reported no remaining actionable findings. There are no unresolved review disagreements.

The reviewer found no additional actionable issues in the quota, database grants, account isolation, cache cleanup or meal-read handling. Review was static and read-only. The implementation session ran the checks above.

A [draft commit message](reliability-hardening.commit.txt) is provided for owner review. No commit, push or deployment was performed.

## Deployment order

These steps are for the owner after diff review. No hosted migration, deployment or real email was performed in this change.

1. Review and apply `supabase/migrations/003_private_profiles_and_ai_quota.sql` once in the target Supabase project. It is transactional and preserves existing profile/report data. It also backfills today's report count into the new quota ledger. Review existing premium assignments if the previous browser privileges were exposed.
2. Deploy the backend and frontend together after the migration. The new backend refuses AI analysis if the reservation RPC is unavailable. Old frontend bundles use the previous onboarding upsert, which the new permissions deny. Coordinate rollout and refresh open tabs or installed PWAs before onboarding new users.
3. In Supabase Auth URL configuration, allow the deployed application's exact `/reset-password` URL. Add `http://localhost:5173/reset-password` separately for development if needed. Check the Site URL and email template configuration.
4. With dedicated synthetic accounts in a separate test project, verify signup/onboarding, A-to-B account switching, recovery email delivery, expired links, meal persistence after reload and three-attempt quota behavior. Confirm ordinary user tokens cannot change `subscription_tier` or invoke the reservation RPC directly.
5. Confirm a refreshed production client has no `supabase-cache`, and that new private requests do not enter CacheStorage. Confirm failed meal reads show retry. Review CI results after push, including the new database and browser-smoke jobs.

## Running the database checks locally

Use an empty, disposable PostgreSQL database named `femfit_test`. The runner refuses non-loopback hosts and other database names. It creates test roles and schema, so do not reuse a database that already contains those objects.

```bash
PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=femfit_test PGUSER=postgres npm run test:db
```

If PostgreSQL is unavailable, an explicitly installed external PGlite runtime can exercise SQL and role permissions:

```bash
node scripts/test-database.mjs --pglite /absolute/path/to/node_modules/@electric-sql/pglite
```

This fallback is optional and is not a project dependency. Use the PostgreSQL job for actual concurrent connections.
