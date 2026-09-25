# Tabiro local foundation specification

Approved architecture: incremental HTML/CSS/JavaScript frontend, modular PHP 8.4 REST API, PDO MySQL, Composer and Phinx. This document records the user's approved architecture and milestone, reviewed against the existing 26-test baseline. No production operation or push is authorized.

## Milestone
User A registers, logs in, creates a private dated trip, adds ordered dated stops, and retrieves it after logging in with a separate session. User B cannot read, update, delete or append children to A's trip. Logout invalidates the old session. Re-running migrations changes nothing.

## Boundaries
Preserve eight HTML pages, palette, artwork, EN/JA/FR translations, navigation and exploration. Replace demo authentication and primary trip persistence; keep browser storage only for preferences and existing demo route bookmarks until the bookmark milestone. No silent browser-data import. No blogs, production admin, live tolls, public sharing or production deployment in this milestone.

## Backend contracts
Same-origin /api/v1 routes return {data:...} or {error:{code,message,fields}}. Endpoints: GET /session, POST /auth/register, POST /auth/login, POST /auth/logout, GET/PATCH /me, GET/POST /trips, GET/PATCH/DELETE /trips/{id}, POST /trips/{id}/days, PATCH/DELETE /trips/{id}/days/{day}, POST /trips/{id}/days/{day}/stops, PATCH/DELETE /trips/{id}/days/{day}/stops/{stop}, PUT /trips/{id}/days/{day}/order. All state-changing requests require CSRF and JSON, including login/register. Session cookies HttpOnly, SameSite=Lax, Secure in production; rotate session on login/register, expire and revoke on logout. Rate-limit auth by IP and normalized account identifier. Password hash PHP PASSWORD_DEFAULT, minimum12 maximum72 UTF8 bytes. Generic credential failures. PDO prepared statements, no raw errors/logged secrets. Routes use owner-filtered lookups, including every nested resource.

## Data model
users(unique email, password_hash, name, locale, status, verified_at, timestamps); roles(unique name); user_roles(unique user/role); sessions(hash-only token, nullable user for CSRF before login, csrf token, expiry); auth_tokens(hashed token, purpose, expiry, consumed_at); auth_rate_limits(bucket hash, count, window); trips(owner FK,title,description,start_date,end_date,travelers,vehicle,budget_minor,currency,private visibility,status,revision,timestamps); trip_members(unique trip/user,role); itinerary_days(trip FK,date,notes,unique trip/date); itinerary_stops(day FK,title,destination nullable FK,position,arrival_time,departure_time,distance_m,driving_minutes,estimated_cost_minor,notes,confirmation_status); destinations(name,category,lat/lng,source_url,verified_at). InnoDB utf8mb4, ownership/FK indexes, cascades only for owned children. Account deletion not exposed. Dates valid Gregorian, end>=start, <=366 days; day within trip; budget integer nonnegative, private only. Stop ordering is transactional complete-set permutation and uniqueness enforced. User text rendered with escaping. Optimistic trip revision protects metadata changes. No insecure public sharing.

## Configuration and delivery
.local/database.php is generated with known disposable credentials; development explicitly rejects non-loopback hosts and database names outside tabiro_development/tabiro_test. Never read root .env. Production requires explicit external config file and environment switch; no automatic migration. Private source outside public deployment, minimal api entrypoint. Local router allowlists frontend assets and denies dotfiles, source, vendor, config. Phinx migration CLI guarded local-only by default, checksums and exclusive lock, failed-run marker, safe bounded errors.

## Tests and evidence
Real MySQL integration via HTTP separate cookie jars. Ownership attacks on parent and nested endpoints, CSRF, expired/logged-out sessions, SQL-like inputs, dates/money validation, concurrency revision, reorder rollback, duplicate registration, failed login, rate limit, raw error non-disclosure. Migration twice, schema FK checks. Frontend jsdom regression and browser integration where available. GitHub Actions only disposable MySQL and PHP8.4, no production secrets. Local verification does not imply Hostinger deployed.

## Review decisions
User explicitly said prepare specification/plan then proceed; no repeat approval gate. Work on dedicated branch in current checkout to preserve visible workflow and unrelated changes; stage explicit paths only. Email verification/reset delivery deferred until SMTP configured; table foundation is included, UI will not falsely claim email sent. Production readiness remains conditional on these flows, HTTPS server checks, backup/restore rehearsal and separate approval.
