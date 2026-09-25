# Tabiro Local Foundation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for the application, with the independent local-runtime setup delegated separately.

**Goal:** Real local authentication and private dated itineraries across sessions with tested account isolation.
**Architecture:** Preserve existing frontend, add same-origin modular PHP/PDO API with private configuration and Phinx migrations. Tests use disposable MySQL only.
**Tech Stack:** PHP8.4, Composer, Phinx, MySQL8.4, existing JavaScript/jsdom, Node HTTP integration tests.
**Spec:** docs/superpowers/specs/2026-09-25-local-foundation.md

## Global Constraints
No production connection, migration, deployment, push, secret exposure or unrelated-file commit. Development never reads .env. Preserve branding and EN/JA/FR. All mutable APIs enforce session CSRF and ownership.

## Review Focus
- Child resource ID belongs to a different parent/user: 404 and no mutation.
- Failure after first reorder write: transaction rollback and consistent order.
- Cookie replay after logout: 401.
- Invalid or reversed calendar dates and out-of-range money:422.
- Source/config URLs through local router:404; failure JSON excludes SQL/credentials.

## Task 1: Safe runtime and schema
Files: composer.json/lock, backend/config.php, phinx.php, database/migrations/*, scripts/migrate.php, scripts/dev-server.php, scripts/dev-setup.php, .gitignore, tests/api.test.mjs.
- [ ] Provision isolated PHP/MySQL, prove SELECT1 on local DB only.
- [ ] Write HTTP milestone test using node:test cookie jars; run before API and observe unavailable endpoint failure.
- [ ] Add schema migration with FKs/unique keys; safe local config and guarded migration runner.
- [ ] Run migration twice; compare history count and validate FKs through information_schema.
- [ ] Commit explicit infrastructure files.
Interfaces: config(): array of PDO credentials and environment; Database::connect(array):PDO. Migration history is owned by Phinx. HTTP tests use TABIRO_TEST_URL loopback only.

## Task 2: API auth and trips
Files: backend/{Database,Http,Auth,Trips,Application}.php, api/index.php, tests/api.test.mjs.
- [ ] Tests request GET /session obtaining csrf token, POST /auth/register/login; assert current user and session rotation.
- [ ] Implement hashed random opaque sessions in MySQL, CSRF, auth rate limiting and scoped repositories.
- [ ] Tests create A trip/day/stop; B GET/PATCH/DELETE and nested inserts all404; separate A login retrieves same stop; logout replay401.
- [ ] Implement trip/day/stop APIs, date/money validation and transactional complete-set reordering.
- [ ] Assert failure paths CSRF403, validation422, stale revision409, rate limit429, generic login401; commit explicit files.
Interfaces: HTTP body {data}, error {error:{code,message,fields}}. Session data {user,csrf_token}; trips data list, individual trip includes days and stops.

## Task 3: Existing frontend integration
Files: assets/js/api.js, assets/js/app.js, assets/js/i18n.js, assets/js/itinerary.js, assets/css/app.css, tests/pages.test.js, tests/api-client.test.js.
- [ ] Add client tests for CSRF headers, credentials, safe errors and untranslated fallback prevention.
- [ ] Replace demo session writes with API auth; async session loading; API trip list and private trip editor on existing planner page.
- [ ] Preserve sample planner as explicitly labeled inspiration; persist real trips via dated editor, never fake successful save.
- [ ] Add EN/JA/FR loading/error/forms; safe text escaping. UI create/edit/delete day/stop and reorder buttons, duplicate stop action.
- [ ] Update tests to assert real API calls with deterministic test boundary; preserve navigation/explore coverage.
- [ ] Run frontend regression plus real HTTP integration; commit explicit paths only.

## Task 4: Repeatable dev and CI, final review
Files: .github/workflows/tests.yml, docs/local-development.md, docs/superpowers/plans/2026-09-25-foundation-progress.md.
- [ ] CI PHP8.4, Composer lock install, disposable MySQL service, migrate twice, start API, run API/frontend tests; no deploy trigger.
- [ ] Document setup/start/test/stop and no production fallback, deferred mail flows, private/public packaging and backup approvals.
- [ ] Run lint, dependency audit and all tests. Fresh reviewer checks authorization/config/session boundaries; fix important findings and rerun.
- [ ] Review staged diff for unrelated changes and secrets; record hashes/test evidence, leave feature branch unpushed.

## Self review
Spec coverage maps configuration/schema to Task1, auth/trips to Task2, preserved UX to Task3, verification/delivery to Task4. Interfaces share JSON envelopes and config signatures above. Email delivery explicitly outside local milestone until provider is configured; no misleading reset UI. No live schema assumptions will be applied locally or remotely.
