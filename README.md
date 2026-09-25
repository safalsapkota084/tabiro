# Tabiro

A multilingual travel-planning application with English, Japanese, and French interfaces, a PHP/PDO MySQL API, account authentication, and private per-user itineraries.

## Pages

- `index.html` — Discover dashboard
- `explore.html` — searchable routes and category filters
- `route.html?id=kyoto` — route details and suggested daily itinerary
- `planner.html` — sample AI-planner interface, itinerary generation, saving, and text export
- `trips.html` — saved routes and itineraries
- `signup.html` — account registration
- `signin.html` — sign-in, email verification, and password recovery
- `account.html` — profile, email verification, and language preferences

All pages accept `?lang=en`, `?lang=ja`, or `?lang=fr`. Other query parameters can be combined, for example `route.html?id=kyoto&lang=ja`. A language choice is retained across page links and, when available, in local storage. The first visit uses the browser language, defaulting to English for unsupported languages.

## Run locally

For a frontend-only preview, use an HTTP server; opening HTML directly with `file://` is not supported because the application uses ES modules.

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000`.

This static preview cannot serve the PHP API. For authenticated accounts and private trips, PHP 8.4 with PDO MySQL, MySQL, and Composer dependencies are required. Private database settings belong only in ignored `.local/database.php`; `php scripts/dev-setup.php` creates a fixed disposable local template and never reads `.env`. Configure a local MySQL service/database separately. Then run the guarded migration with `TABIRO_ENV=test php scripts/migrate.php` for the isolated test database. Start the API/frontend router with `php -S 127.0.0.1:8087 scripts/dev-server.php`. The standard tests exercise the frontend and skip real HTTP/database tests unless `TABIRO_TEST_URL=http://127.0.0.1:8087/api/v1` is set.

The local migration wrapper inspects existing table names and Phinx history before running: untracked application tables or an incomplete foundation stop the migration. It does not adopt, drop, or repair a pre-existing schema. The initial foundation migration is immutable; inspect existing database schema and migration history before any migration attempt, and use a disposable database copy for rehearsal.

Account email uses only the explicitly configured private mail transport. Development/test use a private file sink under ignored `.local/`; no message is sent to an external address. Production requires `MAIL_TRANSPORT => 'mail'`, a valid `MAIL_FROM`, and an HTTPS `APP_URL` in the private config. PHP's local `mail()` transport must be configured by the host. No SMTP credentials are stored in the repository.

## Deploy to the existing server

Upload these items together into the site's public document root, preserving directory names:

- All eight root `.html` files
- The entire `assets/` folder

There is no frontend build step, production npm dependency, API key, or server-side routing requirement. The server should serve `.js` files with a JavaScript MIME type. A normal Apache, Nginx, or static-site configuration can serve these files directly. Keep `node_modules`, tests, package files, and documentation out of the public document root when possible; they are not required for deployment.

Fonts use Google Fonts and photos use Unsplash. System-font and background-color fallbacks are provided; the scenic illustration is a local SVG; the supplied brand logos, category icons, and favicon are local PNGs. Photos are destination inspiration rather than verified stop photography.

After deployment, check the pages directly (including `signup.html` and `planner.html?lang=ja`) and refresh the browser cache if an older CSS or JavaScript file is retained.

## Account and trip behavior

- **AI planner:** generates local sample itineraries from destination, duration, pace, and interests. There is no live AI model, routing engine, availability lookup, price calculation, booking, or payment.
- **Authentication:** registration and login use PHP password hashing, hashed opaque database sessions, HttpOnly/SameSite cookies, CSRF tokens, prepared statements, and rate limits. Password reset and email-verification tokens are random, stored only as hashes, purpose-bound, expiring, single-use, and sent through the configured transport. Reset revokes all active sessions.
- **Private trips:** itinerary API queries are owner-scoped; another account cannot read or mutate a trip or its nested days/stops. Browser local storage is used only for route bookmarks and preferences; no silent import of local itinerary data is performed.
- Storage failures produce localized messages instead of claiming that a save succeeded. Invalid saved records are ignored.

## Structure

- `assets/css/app.css` — responsive layout, components, and mobile styles
- `assets/js/app.js` — shared page rendering, navigation, and interactions
- `assets/js/i18n.js` — interface translations and locale resolution
- `assets/js/data.js` — translated sample routes and itinerary generation
- `assets/js/store.js` — defensive storage helpers
- `assets/images/` — local illustration and favicon

## Checks

Node.js 22 or later is recommended for development checks. Install development dependencies, then run:

```sh
npm ci
npm test
```

Tests cover all eight pages in all three languages, authentication UI and API client behavior, private trip editing, recovery-link handling, database diagnostics, and account recovery/ownership integration flows. Real MySQL integration tests require the guarded loopback PHP API and disposable `tabiro_test` database; otherwise those tests are skipped. jsdom does not perform visual layout verification.

Production migration, deployment, email delivery, schema adoption, and any work against production data require separate explicit approval. Before any production change, inspect the existing schema and Phinx history read-only, take and verify a restorable backup, and rehearse against a disposable copy. Never assume an empty production database; stop for manual review if application tables exist without a matching, complete foundation migration. No production migration or SSH operation has been performed by these local instructions.

## Brand theme

The shared stylesheet uses the supplied palette: forest `#1F2F2A`, terracotta `#A9574B`, sand `#A99886`, mint `#88E1D6`, and charcoal `#2E2E2E`. Surface and border colors are derived tints of these values. Original PNG artwork is used without recoloring or stretching.

- `tabirologo&typographyvertically.png`: navigation and desktop account-page lockup
- `tabiromain.png`: account-page brand artwork
- `tabirotypography.png`: footer and mobile account-page wordmark
- `tabiroicon.png`: favicon, Discover icon, and mobile header
- Explore, location, nature, culture, and scenic-road PNGs: matching navigation, route badges, filters, and planner interests

`tabirologos.png` is retained as the brand reference sheet.

## Cache versions for deployment

All site-owned CSS, JavaScript imports, PNG/SVG images, favicons, and internal page links carry a numeric `v` query parameter. Destination photo URLs also carry it. Google Fonts remains provider-managed.

Before each future deployment, run:

```sh
npm run version:assets
```

This increments the last numeric component in `asset-version.json` and updates all release URLs. To choose a specific number instead, run `npm run version:assets -- 20260914.3`. Commit and deploy the changed HTML files and `assets/` together. The command prints the current first-visit URL.

For this release, open `https://tabiro.digitalthakali.com/?v=20260914.2` after deploying. This also gives the initial HTML request a fresh URL; asset versions alone cannot replace an already cached HTML response. If that URL still serves the previous site, verify the server deployment and any CDN cache, including whether its cache key ignores query strings. Versioning changes browser requests; it does not publish files to the server.
