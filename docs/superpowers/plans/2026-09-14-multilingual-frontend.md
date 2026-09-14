# Multilingual Tabiro frontend implementation plan

**Goal:** Replace the landing page with a navigable English, Japanese, and French travel application frontend.

**Architecture:** Static HTML entry points share an ES module application, translation dictionaries, route data, and CSS. Locale travels in internal URLs and local storage. Account interactions are explicit UI demonstrations with session-only display names; passwords and email addresses are never saved or sent. The itinerary planner uses local templates, with no AI service or backend.

**Tech stack:** HTML, CSS, JavaScript ES modules; Node's built-in test runner with jsdom for DOM checks. No build or production runtime dependencies.

## Deliverables
- `index.html`: dashboard with destinations and planner entry points.
- `explore.html`: searchable/filterable destination collection.
- `route.html?id=…`: translated destination detail and daily itinerary.
- `planner.html`: preferences form and template-generated itinerary, save and export.
- `trips.html`: saved routes and planned trips, including empty states and removal.
- `signin.html`, `signup.html`: accessible validated demo account forms.
- `account.html`: demo profile, locale settings, and sign-out.
- `assets/js/i18n.js`: complete locale dictionaries and safe interpolation.
- `assets/js/data.js`: translated route content and validated planner generation.
- `assets/js/store.js`: defensive browser persistence.
- `assets/js/app.js`, `assets/css/app.css`: shared page rendering and responsive shell.

## Execution and validation
- [x] Write failing tests for translation parity, interpolation, planner inputs and output, and malformed stored data.
- [x] Implement shared locale, route, planner, and storage modules; run tests.
- [x] Build real HTML page entries, shared layout, dashboard, exploration, and route details.
- [x] Build planner, saved trips, and demo account flows with localized validation and empty states.
- [x] Check all module syntax, internal files/links, translation coverage, and tests. Attempt browser verification when an attached browser is available.
- [x] Review implementation, address material issues, and document static-server deployment and frontend limitations.

## Verification result

15 tests pass. DOM rendering and navigation were checked for all 24 page/language combinations. Code review findings for malformed persisted plans, cross-tab saving, and mobile menu focus were reproduced and fixed. Visual rendering could not be checked because no browser is attached. This work changes the local repository only; production deployment has not been performed.
