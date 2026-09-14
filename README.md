# Tabiro

A multilingual travel-planning frontend with English, Japanese, and French interfaces. This is a static application preview, with real page navigation and browser-local trip saving.

## Pages

- `index.html` — Discover dashboard
- `explore.html` — searchable routes and category filters
- `route.html?id=kyoto` — route details and suggested daily itinerary
- `planner.html` — sample AI-planner interface, itinerary generation, saving, and text export
- `trips.html` — saved routes and itineraries
- `signup.html` — demo account creation
- `signin.html` — demo sign-in
- `account.html` — demo profile and language preferences

All pages accept `?lang=en`, `?lang=ja`, or `?lang=fr`. Other query parameters can be combined, for example `route.html?id=kyoto&lang=ja`. A language choice is retained across page links and, when available, in local storage. The first visit uses the browser language, defaulting to English for unsupported languages.

## Run locally

Use an HTTP server; opening HTML directly with `file://` is not supported because the application uses ES modules.

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000`.

## Deploy to the existing server

Upload these items together into the site's public document root, preserving directory names:

- All eight root `.html` files
- The entire `assets/` folder

There is no frontend build step, production npm dependency, API key, or server-side routing requirement. The server should serve `.js` files with a JavaScript MIME type. A normal Apache, Nginx, or static-site configuration can serve these files directly. Keep `node_modules`, tests, package files, and documentation out of the public document root when possible; they are not required for deployment.

Fonts use Google Fonts and photos use Unsplash. System-font and background-color fallbacks are provided; the scenic illustration is a local SVG; the supplied brand logos, category icons, and favicon are local PNGs. Photos are destination inspiration rather than verified stop photography.

After deployment, check the pages directly (including `signup.html` and `planner.html?lang=ja`) and refresh the browser cache if an older CSS or JavaScript file is retained.

## Frontend-only behavior

- **AI planner:** generates local sample itineraries from destination, duration, pace, and interests. There is no live AI model, routing engine, availability lookup, price calculation, booking, or payment.
- **Account screens:** demonstrate validation and navigation. No real account is created or authenticated. Email and password inputs are never sent or saved by the application. Only a demo display name is held in the tab's session storage.
- **Saved trips:** stored in this browser's local storage, independently of the demo profile. Signing out does not remove them. They are not synced across devices or users. Clearing site data removes them.
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

Tests cover all eight pages in all three languages, valid navigation links, translated validation, filtering, language selection, planner preferences, saved-state corruption, cross-tab save preservation, keyboard menu focus, and escaping of profile names. jsdom is a development-only DOM test dependency; it does not perform visual layout verification.

Before production use, connect a real authentication service and backend, add authorization and server-side validation, and replace template-based planning with the intended service.

## Brand theme

The shared stylesheet uses the supplied palette: forest `#1F2F2A`, terracotta `#A9574B`, sand `#A99886`, mint `#88E1D6`, and charcoal `#2E2E2E`. Surface and border colors are derived tints of these values. Original PNG artwork is used without recoloring or stretching.

- `tabirologo&typographyvertically.png`: navigation and desktop account-page lockup
- `tabiromain.png`: account-page brand artwork
- `tabirotypography.png`: footer and mobile account-page wordmark
- `tabiroicon.png`: favicon, Discover icon, and mobile header
- Explore, location, nature, culture, and scenic-road PNGs: matching navigation, route badges, filters, and planner interests

`tabirologos.png` is retained as the brand reference sheet.
