# Proposal

## Why

Service points — dealers, service centres, and warehouses — are one of the four public sections the product promises, but the collection and the map page do not exist yet. Visitors currently have no way to find a nearby point, and administrators have no structured place to record coordinates and contact details. A read-only map backed by an admin-managed collection closes that gap without adding a write path to the public frontend.

## What Changes

- **Add a `service-points` collection** with the minimum a marker needs plus optional contact details: `name` (required text), `type` (select: dealer, service centre, warehouse), `latitude` and `longitude` (required numbers with range validation), `address` (optional textarea), `phone`, `email`, and `website` (optional), and `notes` (optional short text). No drafts: every saved point is public.
- **Enforce access at the collection level.** Anonymous callers may read every service point; `create`, `update`, and `delete` require an authenticated administrator session. The public frontend gets no write path, and the admin panel remains the only editing surface.
- **Add a read-only public map page at `/service-points`** rendered by a React Server Component. It reads the collection through the Local API with `overrideAccess: false`, then mounts an interactive **MapLibre GL JS** map on the client. Every point is a marker; clicking a marker opens a read-only popup with the point's name, address, and available contact details. The page contains no forms, edit/delete controls, admin links, or write-capable client code.
- **Render a correct empty state.** With zero points the page still responds successfully and shows an explanatory message instead of an empty or broken map; it must not throw.
- **Make the map usable on mobile.** The map container is responsive, uses touch-friendly markers and popups, and does not introduce horizontal overflow on narrow screens.
- **Configure the map through the environment.** The MapLibre style URL is read from `NEXT_PUBLIC_MAP_STYLE_URL`; the basemap tile/style provider stays an open question in the design, so the implementation does not hardcode one. Local verification uses a bundled, keyless Natural Earth demo style (`/map-style.json`), so no API key, tile service, or paid account is required; a deployment can point the variable at any MapLibre-compatible style. **Add `maplibre-gl`** as the only new runtime dependency.
- **Modify `project-baseline`**: its "Minimal runtime surface" requirement names the registered collections and must admit `service-points`. The rest of the baseline is unchanged.
- **Update `AGENTS.md`** so it no longer says service points are unimplemented, names the collection and the public route, and records the restart-and-regenerate runbook. Add a link to `/service-points` on the home page.

This change touches the **service points** public section. It does not change news, articles, or equipment listings, and it does not add any write path to the public frontend.

**Out of scope:** equipment listings; geocoding, address search, directions, clustering, geolocation, offline maps, custom map styling, marker filtering or search; a PostGIS-backed `point` field and geospatial queries; drafts, scheduling, localization, or additional administrator roles for service points; production tile hosting and SLA; production database migrations.

## Capabilities

### New Capabilities

- `service-points`: the service point content model, public read and admin-only mutation rules, the read-only MapLibre map page, its marker popups, empty state, and mobile behaviour.

### Modified Capabilities

- `project-baseline`: the "Minimal runtime surface" requirement changes to list `service-points` among the registered product collections.

## Impact

- **Added**: `src/collections/ServicePoints.ts`, `src/lib/service-points.ts`, `src/lib/service-point-utils.ts`, `src/app/(frontend)/service-points/` (page, client map component, CSS module), a bundled demo map style and Natural Earth geometry under `public/`, `scripts/copy-maplibre-worker.mjs`, and service point integration and end-to-end tests with a seed helper.
- **Modified**: `src/payload.config.ts` (register the collection), `src/app/(frontend)/page.tsx` (link to the map page), `AGENTS.md`, `.env.example` (`NEXT_PUBLIC_MAP_STYLE_URL`), `package.json` and `pnpm-lock.yaml` (`maplibre-gl`), generated `src/payload-types.ts`, and the `project-baseline` delta spec.
- **APIs**: `GET /api/service-points` and `GET /api/service-points/:id` are public; `POST`, `PATCH`, and `DELETE` require an authenticated administrator session and are rejected otherwise. No custom endpoints.
- **Database**: one new `service-points` table, created by the Postgres adapter's development schema push; no PostGIS extension and no hand-written migration.
- **External services**: MapLibre GL JS renders the style configured by `NEXT_PUBLIC_MAP_STYLE_URL`. The committed default is a local Natural Earth demo style, so no external map service, API key, or paid plan is required for local use; the production tile/style provider remains an open question in the design.
