# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

myRadio7 is a Bulgarian-language PWA (Progressive Web App) for streaming online radio stations. It is a static, vanilla JS/HTML/CSS app with no build step, no package manager, and no framework — deploy by copying files to the web root.

## Deployment

The app is served by nginx at `/var/www/myradio7` (domain: `rsdio.vtsigov.eu`). After editing files, reload nginx if `nginx.conf` changed:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

No build process. Changes to JS/CSS/HTML are live immediately (but browsers may cache static assets for up to 1 year per nginx config — use cache-busting query strings if needed during development).

## Architecture

Four JS modules load in order via `<script>` tags (no modules/imports):

1. **`js/api.js`** — `RadioAPI` IIFE. Wraps the [radio-browser.info](https://api.radio-browser.info/) REST API. Discovers a live server on first call, falls back to known servers. All methods return Promises.

2. **`js/favorites.js`** — `Favorites` IIFE. Stores station objects in `localStorage` under key `myradio7_favorites` (keyed by `stationuuid`). Dispatches `favoritesChanged` CustomEvent on mutations.

3. **`js/player.js`** — `Player` IIFE. Manages the HTML `Audio` element, state machine (`idle | loading | playing | paused | error`), retry logic (up to 2 retries with alternate URL), and Media Session API integration. Emits `stateChange` and `stationChange` events via internal `on()`/`emit()`.

4. **`js/app.js`** — Main controller IIFE. Owns all DOM manipulation and view rendering. Three views: `home`, `search`, `favorites`. Uses event delegation on `#app` for station card clicks. Listens to `Player` events and `favoritesChanged` to keep UI in sync.

### Key patterns

- All HTML is rendered by string interpolation in JS — no templating engine. Use `escapeAttr()` for user/API data in HTML attributes.
- Station cards carry `data-uuid` attributes; clicks are resolved back to station objects by searching `state.homeFeatured`, `state.homeStations`, `state.searchResults`, and `Favorites.getAll()`.
- The service worker (`sw.js`) uses cache-first for app shell, network-only for API calls, stale-while-revalidate for station logos, and passthrough for audio streams. **Bump `CACHE_NAME` in `sw.js` when deploying breaking changes** to force clients to update.
- UI language is Bulgarian (bg).
- Hash routing: `#home`, `#search`, `#favorites` are valid deep-link targets.

### Station object shape

Key fields from radio-browser.info used throughout the app: `stationuuid`, `name`, `url`, `url_resolved`, `favicon`, `tags`, `country`, `countrycode`, `bitrate`, `codec`, `votes`. `Favorites.add()` saves a subset of these plus `savedAt`.

### API quirks

- Most `RadioAPI` methods return a flat array of station objects.
- `RadioAPI.getFeaturedBulgarian()` returns `{ featured: [...], all: [...] }` — the only method with a different shape. `app.js:loadHomeCategory()` special-cases the `'bg'` category to handle this.

### Known issues

- None currently. `hasActiveSearch()` is correct (reads state, no recursion). `DOM.searchInput` was previously cached as `null` (before the input existed) — fixed by using `document.getElementById()` dynamically in `navigate()`.
