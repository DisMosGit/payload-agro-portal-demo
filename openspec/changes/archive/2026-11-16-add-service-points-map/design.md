# Design

## Context

See `proposal.md` — Why, and `specs/service-points/spec.md` for the behavior contract. Current state that shapes the approach:

- Payload 3.93 on the Next.js 16.4 App Router with PostgreSQL. `src/payload.config.ts` registers `Users`, `Media`, `ArticleAttachments`, `Articles`, and `News`; there is no service point collection and no map dependency.
- The public frontend is read-only and server-rendered. Existing section reads live in `src/lib/` and call the Local API with `overrideAccess: false` (`src/lib/news.ts`, `src/lib/articles.ts`). Pages opt out of static prerendering with `export const dynamic = 'force-dynamic'`, so a save in the admin panel is visible on the next request.
- The project runs PostgreSQL 17 Alpine without PostGIS. Payload's `point` field stores geospatial data through PostGIS on the Postgres adapter, so using it would require a different database image and an extension, not just a schema change.
- The project context has no decided basemap tile/style provider. The map library and the basemap source are therefore treated separately: the library is chosen here, the provider stays an open question and is supplied through configuration.
- There is no styling framework and no client-side data fetching pattern; sections use CSS modules. Playwright and Vitest are already configured, with `workers: 1` and `fileParallelism: false` because suites share one development database.
- `slugField()` is not needed: service points have no public per-item route and no slug. The helper's 3.93 caveat does not apply.

## Goals / Non-Goals

**Goals:**

- One collection-level access model that gates both API and frontend reads, with no public write path.
- A map page that keeps MapLibre out of the server bundle and out of the initial HTML-critical path, while still rendering the point data on the server.
- A page that degrades safely: zero points shows an empty state, and a map initialization failure does not hide the point data.
- Verification of the three requested behaviours through the real admin UI, the real HTTP API, and a mobile viewport.

**Non-Goals:**

- Choosing or hardcoding a basemap tile/style provider; geocoding, routing, clustering, geolocation, search, or filtering.
- A PostGIS `point` field, geospatial queries, or a database image change.
- Drafts, scheduled publishing, localization, roles, or per-point public pages.
- Production database migrations or a map production deployment.

## Decisions

### D1 — Collection shape in `src/collections/ServicePoints.ts`

| Field       | Type     | Rules                                             | Purpose                                    |
| ----------- | -------- | ------------------------------------------------- | ------------------------------------------ |
| `name`      | text     | required, indexed by the admin list title         | Marker and list label                      |
| `type`      | select   | optional; `dealer`, `service-centre`, `warehouse` | Distinguishes the three point kinds        |
| `latitude`  | number   | required, `min: -90`, `max: 90`                   | Map latitude                               |
| `longitude` | number   | required, `min: -180`, `max: 180`                 | Map longitude                              |
| `address`   | textarea | optional                                          | Postal address shown in the popup and list |
| `phone`     | text     | optional                                          | Contact detail                             |
| `email`     | email    | optional                                          | Contact detail                             |
| `website`   | text     | optional                                          | Contact detail                             |
| `notes`     | textarea | optional, max 500 characters                      | Short admin/visitor note                   |

Collection settings: `slug: 'service-points'`, `admin.useAsTitle: 'name'`, `admin.defaultColumns: ['name', 'type', 'latitude', 'longitude']`, `admin.group` left unset, `defaultSort: 'name'`. No `versions`, no drafts, and no slug field.

Rationale: coordinates are stored as two numbers rather than a `point` field because the page only needs to place markers, not to run `near`/`within`/`intersects` queries. A `point` field on PostgreSQL requires PostGIS, which the current `postgres:17-alpine` image does not provide; switching images and enabling an extension would add infrastructure risk for a feature that needs none of the geospatial query operators. Two numeric fields also avoid the `[longitude, latitude]` ordering trap at the storage layer: the conversion happens once, in the map component.

Alternative: switch Compose to a PostGIS image, enable the extension, and use `point`. Rejected for this change because it changes the baseline stack and is only useful once spatial querying exists. If a later change needs distances or bounding-box queries, migrating to `point` is a contained follow-up.

The `type` select is optional and uses stable machine values with readable labels; the frontend maps the values to display labels and falls back gracefully if an unknown value is stored.

### D2 — Access control matrix

```ts
access: {
  read: () => true,
  create: ({ req: { user } }) => Boolean(user),
  update: ({ req: { user } }) => Boolean(user),
  delete: ({ req: { user } }) => Boolean(user),
}
```

- Anonymous `read` is unconditional: service points are public directory data. The same function governs REST, GraphQL, and Local API reads, so `/api/service-points` and the page helper see the same set.
- Mutations are boolean-gated on an authenticated session. `Users` is the only auth collection and has no role field, so "authenticated" and "administrator" are the same set in this project, matching the existing collections.
- No field-level access, no hooks, and no draft status. "Management only through the admin panel" is enforced by requiring an administrator session; a signed-in administrator could still call the REST API, exactly as with news and articles. The public frontend has no create, update, or delete path.
- `access.admin` stays at its default (authenticated users only), so the collection appears in the admin panel only after sign-in.

### D3 — Public read module `src/lib/service-points.ts`

```ts
export const getServicePoints = cache(async (): Promise<ServicePoint[]> => {
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'service-points',
    overrideAccess: false,
    depth: 0,
    pagination: false,
    sort: 'name',
  })

  return docs
})
```

- `overrideAccess: false` is deliberate and matches the news/articles pattern: the collection's public `read` rule must run, and no page-level filter substitutes for it.
- `depth: 0` because the collection has no relationships; `pagination: false` returns every point instead of Payload's default 10, which would silently hide markers.
- `cache()` deduplicates the read between the page and any metadata/helper consumer within one request. The page still uses `export const dynamic = 'force-dynamic'`, so every reload re-reads the database.
- A pure helper `toMarkerData(point)` maps a `ServicePoint` to a small serializable object (`id`, `name`, `type`, `latitude`, `longitude`, `address`, `phone`, `email`, `website`) so no Payload internals or `Date` objects cross into the client component.

### D4 — Map rendering: MapLibre GL JS, client-only

- Add `maplibre-gl` as a runtime dependency and import its stylesheet in the client map component.
- `src/app/(frontend)/service-points/ServicePointsMap.tsx` is a `'use client'` component. It imports `maplibre-gl` statically; the module is only reachable through the client-only loader below, so no browser global is evaluated during server rendering or the build.
- `src/app/(frontend)/service-points/ServicePointsMapLoader.tsx` is a thin `'use client'` wrapper using `next/dynamic(() => import('./ServicePointsMap'), { ssr: false, loading: … })`. Next 16 forbids `ssr: false` in a Server Component, so the wrapper keeps the map bundle client-only.
- The style URL comes from `process.env.NEXT_PUBLIC_MAP_STYLE_URL`. The committed default is `/map-style.json`, a local demo style that draws Natural Earth country geometry from `/world-countries.geojson`; it needs no API key, tile service, or network access. A deployment can point the variable at any MapLibre-compatible style, so the production provider remains an open question. When the variable is missing, the component renders a "map is not configured" notice and the server-rendered list remains complete.
- Turbopack's generated MapLibre worker URL 404s in this project. `scripts/copy-maplibre-worker.mjs` copies the self-contained `maplibre-gl-worker.mjs` to `public/` as part of `postinstall`, `predev`, and `prebuild`; the component calls `maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')` before creating the map. The generated public file is gitignored.
- The map frame gets an explicit responsive height from the CSS module; MapLibre requires a sized container, and a zero-height frame is the usual cause of an invisible map. A resize on the style's `load` event covers a late layout shift.
- Map initialization is wrapped in `try`/`catch`. On failure, the component sets an error state and renders a notice; the page still shows the point list. This covers blocked WebGL, a blocked style URL, and headless-browser limitations.
- Cleanup calls `map.remove()`; a disposed guard prevents work from attaching to an unmounted container. React development double-invocation therefore does not leave two maps.

Alternatives considered:

- Leaflet with raster tiles: smaller, but the project and user explicitly asked for a MapLibre-style vector map, and MapLibre gives touch-friendly vector rendering and popups without a paid SDK.
- Google Maps or Mapbox GL JS: require an API key and a proprietary SDK; contrary to the free/open-source requirement.
- A static map image: no clickable markers and no interaction; rejected.

### D5 — Markers, popups, and map framing

- Each point becomes a `maplibregl.Marker` whose element is a real `<button type="button">` with an accessible label such as `Show details for <name>`. Using a button instead of MapLibre's default `<div>` gives keyboard activation, a touch target that CSS can size, and a stable selector for tests.
- Clicking a marker builds a popup with DOM nodes and `textContent`, then calls `popup.setDOMContent(...)`. No `innerHTML`, no authored text interpreted as markup, and no form controls inside the popup. The only button is MapLibre's close control.
- Popup content: name as a heading, the type label when present, address when present, and phone, email, and website when present. Missing fields are omitted rather than rendered as empty rows. The website is rendered as an `http:`/`https:` link only after protocol validation; otherwise it is plain text.
- Framing: one point centers at zoom 12; several points use `LngLatBounds` plus `fitBounds({ padding: 48, maxZoom: 12 })`. Coordinates are passed as `[longitude, latitude]`, the order MapLibre expects.
- A `NavigationControl` (zoom buttons, no compass) is added at the top-right. It is a navigation control, not an editing control.
- Points with non-finite coordinates are skipped defensively; the collection validation should prevent them, but the page must not crash on bad data.

### D6 — Page composition and empty state

`src/app/(frontend)/service-points/page.tsx` is a Server Component with `export const dynamic = 'force-dynamic'`. It renders:

1. A heading and short introduction.
2. When `points.length === 0`: a single empty-state panel (`No service points have been added yet.`) and no map component, so MapLibre is never initialized for an empty collection.
3. When points exist: `<ServicePointsMapLoader points={…} />` followed by a server-rendered `<section>` list of every point, with name, type, address, and available contact details.

The list is the no-JavaScript and accessibility fallback: the map canvas is not readable text, and a failed or blocked map must not hide the data. It also gives e2e tests and crawlers a stable HTML surface. Neither the map nor the list renders a form, an edit/delete control, an admin link, or client-side write code. The page receives its data as props from the server; the client component does not fetch or mutate anything.

Route choice: `/service-points` matches the collection slug and the other section routes (`/news`, `/articles`). The home page gains a link to it. No rewrite or redirect is needed.

### D7 — Responsive layout and mobile behaviour

- A CSS module gives the map an explicit responsive height (`clamp(18rem, 55vh, 32rem)`) and `width: 100%`; MapLibre requires a sized container, and an intrinsic height of zero is the usual cause of an invisible map.
- The list uses `grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr))`, so it collapses to one column without overflowing.
- Marker elements get a minimum 2rem square hit area, and popup content uses `max-width: min(18rem, calc(100vw - 3rem))` with `overflow-wrap: anywhere`.
- No fixed pixel page width, no horizontal scroll container, and the page wrapper uses `max-width` with fluid padding. This is verified at a 390×844 viewport with a horizontal-overflow assertion.

### D8 — Configuration, generated artifacts, and documentation

- `.env.example` gains `NEXT_PUBLIC_MAP_STYLE_URL` with a comment describing it as a free, keyless MapLibre style URL. The committed example points at the bundled `/map-style.json`; a deployment may use any style and the production provider stays an open question. No secret is involved, so the variable is public by design.
- `public/map-style.json` and `public/world-countries.geojson` are committed demo assets (Natural Earth geometry, public domain, attributed in the style source). `public/maplibre-gl-worker.mjs` is generated and gitignored.
- Register `ServicePoints` in `src/payload.config.ts`, then run `pnpm generate:types` and `pnpm generate:importmap`. Neither generated file is hand-edited. No custom admin component is added; the import map run is part of the project's standard post-collection procedure.
- `AGENTS.md` is updated to say service points are implemented, name the collection and `/service-points`, and keep equipment listings as the only unimplemented section. `README.md`'s map-integration row is updated from `? API` to the chosen open-source library. No Compose, Docker, or Node-engine change is required.
- The database table is created by the Postgres adapter's development schema push. No migration is authored; production migration remains out of scope.

### D9 — Verification design

1. **Access and validation (integration, `tests/int/service-points-access.int.spec.ts`)** — seed points with unique names; assert an anonymous Local API `find` with `overrideAccess: false` returns them; assert anonymous `create`, `update`, and `delete` with `overrideAccess: false` reject without changing data; assert an authenticated user can create, update, and delete; assert latitude `91` and longitude `181` are rejected while the boundary values −90/90 and −180/180 are accepted. Clean up fixtures in `afterAll`.
2. **Map page (e2e, `tests/e2e/service-points.e2e.spec.ts`)** — seed two points through the Local API helper. Assert `/service-points` returns 200, the map region and its canvas appear, one marker button exists per point, and the server-rendered list contains each name, address, and contact. Click a marker and assert the popup shows the name and present details and contains no `input`, `form`, save, edit, or delete control. Assert the served HTML has no `<form>`, no `href="/admin"`, and no edit/delete controls. Assert the page has no horizontal overflow at the default viewport.
3. **Empty state (e2e, same suite or a dedicated test)** — snapshot all existing service points through the Local API, delete them, reload `/service-points`, assert 200 plus the empty-state message and no map container, then restore the snapshot (or recreate the fixtures) in `afterAll`. The suite runs with `workers: 1`; the snapshot/restore avoids destroying manual development data.
4. **Freshness after admin save (e2e, `tests/e2e/service-points-admin.e2e.spec.ts`)** — sign in with `tests/helpers/login.ts`, open `/admin/collections/service-points/create`, fill name, latitude, longitude, address, and a contact, click Save (there is no draft state), wait for the `POST /api/service-points` response, then open `/service-points` in a fresh anonymous context and assert the new name is in the server-rendered list and a marker exists. Reload once more to prove the value comes from storage, not a client cache. Delete the created point in `afterAll`.
5. **Mobile (e2e, same map suite)** — create a context from `devices['iPhone 13']`, open the page, assert the map and marker are visible, assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`, activate a marker, and assert the popup is visible within the viewport.
6. **Gates** — `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test:int`, `pnpm test:e2e`, and `pnpm build`. Prerequisites: PostgreSQL reachable, Playwright Chromium installed, the dev server restarted after the collection config change, and `/admin/login`, `/articles`, `/news`, and `/admin/collections/articles/create` warmed once before the e2e run.

Test hygiene: unique names/suffixes per run, fixtures created through the authenticated Local API, deletion in `afterAll`, and no reliance on seeded demo content. The empty-state test restores the prior collection contents rather than leaving the shared database emptied.

## Risks / Trade-offs

- **Headless WebGL may be unavailable** → MapLibre needs WebGL; Playwright's Chromium normally provides it through SwiftShader. The component catches initialization failures and keeps the server-rendered list, so the page still works; if the e2e suite cannot create a map, launch Chromium with SwiftShader and keep the list assertions as the fallback. Do not weaken the marker assertion to hide a real failure.
- **MapLibre in the server bundle** → Importing `maplibre-gl` at module scope in a Server Component would evaluate browser globals during SSR/build. Mitigation: the only import path is through `next/dynamic` with `ssr: false` in a client wrapper.
- **Turbopack's worker URL 404s** → Observed in this project: the map rendered markers but no tiles, with `Worker failed to load`. Mitigation: copy MapLibre's self-contained worker to `public/` and call `setWorkerUrl` before map creation; the copy runs on install, dev, and build.
- **Headless WebGL rendering can differ from a real browser** → In this environment, headless Chromium screenshots sometimes show the WebGL basemap drawn into a 400×300 corner even though the canvas element and its drawing buffer are 1024×396. Markers and popups are unaffected, and the e2e suite asserts the canvas, marker count, popup contents, and mobile layout rather than pixels. Check the basemap in a real browser during sign-off; if the clipping reproduces there, investigate the GPU/driver stack before changing the page structure.
- **Demo basemap is coarse** → The local Natural Earth style shows country outlines, not streets or labels. It exists so the page works without a tile provider, key, or network; a deployment should set `NEXT_PUBLIC_MAP_STYLE_URL` to a production style. Attribution for the demo data stays visible in MapLibre's attribution control.
- **Provider availability, rate limits, and attribution** → Production styles have no SLA through this page. The URL is configuration, so a self-hosted or commercial-free style can replace the demo without code changes. The production provider remains an open question, and minimal MapLibre attribution must stay enabled.
- **Deleting and restoring points in the empty-state test** → A crash between delete and restore could empty the shared dev database. Mitigation: snapshot the documents, restore them in `afterAll` even when the test fails, and keep the test in the serialized worker. Alternatively run it against a disposable database.
- **Two coordinate fields can drift from the map's `[lng, lat]` order** → Convert once in `toMarkerData`/the map component, name the variables `longitude`/`latitude`, and keep the conversion out of the admin model. A transposed coordinate is visually obvious in the popup and is covered by the seeded e2e marker.
- **No pagination** → `pagination: false` returns all points; fine for a demo directory. A large collection should later add server-side bounds or pagination, which would change the list spec rather than the access model.
- **Server-rendered list duplicates popup content** → Intentional: it is the no-JS and screen-reader surface, and it keeps data visible if the map fails. The duplication is small and read-only.
- **Public API exposes every point** → Intended: these are public directory locations with no private fields. Do not add internal notes to the collection without re-checking the read rule.
- **Schema push instead of a migration** → Convenient in development, not a deployment strategy. A follow-up must generate and review a Postgres migration before production.
- **The page reads on every request** → `force-dynamic` trades caching for freshness. The collection is small; if traffic grows, add caching plus targeted revalidation without changing access control.

## Migration Plan

1. Add `src/collections/ServicePoints.ts` and register it in `src/payload.config.ts`; add `maplibre-gl` and `NEXT_PUBLIC_MAP_STYLE_URL`.
2. Run `pnpm generate:types` and `pnpm generate:importmap`; restart the dev server so Payload registers the new collection.
3. Boot the app or run `pnpm test:int` once so the Postgres adapter pushes the `service_points` table.
4. Add `src/lib/service-points.ts`, the `/service-points` page, the client map components, and the CSS module; link the page from the home page.
5. Add the seed helper, integration tests, and e2e suites; update `AGENTS.md`, `README.md`, and `.env.example`.
6. Run the verification ladder and manually spot-check: anonymous map, marker popups, mobile viewport, admin create → reload, empty collection.

Rollback: remove the page, map components, helper, tests, dependency, and collection registration; regenerate types; drop the `service_points` table (or restore the pre-change database). No production data or migration is involved, so no backfill is needed.

## Open Questions

- **Production basemap tile/style provider** — still undecided. The page reads `NEXT_PUBLIC_MAP_STYLE_URL` and has no hardcoded provider. The local keyless style is sufficient for verification, but a production choice must weigh hosting, rate limits, attribution requirements, and offline/self-hosting plans. This does not change the specs, the page structure, or the task breakdown.
- **Point volume and clustering** — deferred. The current page renders every point; clustering or viewport filtering is a follow-up if the directory grows large.
- **Website URL validation policy** — the popup only linkifies `http:`/`https:` values; whether the admin field should enforce a stricter URL format is deferred.
- **Production migrations** — the project still needs a migration workflow before a non-development deployment.
