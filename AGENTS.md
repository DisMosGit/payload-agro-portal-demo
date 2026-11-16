# Agents

## Project

Payload CMS 3 on the Next.js App Router with PostgreSQL, written in TypeScript. The public frontend is read-only; every content change is made by an authenticated administrator in the Payload admin panel at `/admin`. News is implemented with the `news` collection and the public routes `/news` and `/news/[slug]`. Articles are implemented with the `articles` and `article-attachments` collections and the public routes `/articles` and `/articles/[slug]`. Service points are implemented with the `service-points` collection and the public route `/service-points`, which renders markers with MapLibre GL JS. Equipment listings are not implemented yet.

## Setup

Use Node 22.23.5 (the version in the Compose image) or another version accepted
by `engines` in `package.json`. Node 24.21.x is outside that range and makes
every pnpm command print an "Unsupported engine" warning. pnpm comes from
corepack.

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm exec playwright install chromium
```

Then fill in `PAYLOAD_SECRET` and the Postgres values in `.env`.

## Commands

| Task | Command |
| --- | --- |
| Dev server on http://localhost:3000 | `pnpm dev` |
| App + PostgreSQL with Compose | `docker compose up -d` |
| Stop the stack, keep data | `docker compose down` |
| Type check | `pnpm exec tsc --noEmit` |
| Lint | `pnpm lint` |
| Production build | `pnpm build` |
| Integration tests | `pnpm test:int` |
| End-to-end tests | `pnpm test:e2e` |

Compose installs dependencies inside the `node_modules` volume on first start; database files and uploaded media persist in the `pgdata` and `media` volumes. Run either the Compose app or `pnpm dev` on port 3000, not both.

## One-off Payload scripts

- Run scripts that call `getPayload()` with `pnpm payload run <script.ts>`, not
  bare `tsx` or `node`. A bare `tsx` process can stay alive on the
  `jobs.autoRun` cron in `src/payload.config.ts` after the work is done; a seed
  script here stayed alive for over 180 s after inserting its rows, while
  `pnpm payload run` completed and exited 0.

## Local runbook

- Restart the app after changing `src/payload.config.ts` or a collection config
  (`docker compose restart app`, or restart `pnpm dev`). Next hot reload does not
  re-register collections; Payload then answers
  `The collection with slug <slug> can't be found`.
- After a collection or block change, run `pnpm generate:types`; when admin
  components change, run `pnpm generate:importmap`.
- The `/service-points` map reads `NEXT_PUBLIC_MAP_STYLE_URL`; restart the app
  after changing it because Next inlines public env values. The default
  `/map-style.json` is a local, keyless demo style backed by
  `public/world-countries.geojson`. `scripts/copy-maplibre-worker.mjs` copies
  MapLibre's worker to `public/maplibre-gl-worker.mjs` during install, `dev`, and
  `build`; do not hand-edit the generated worker.
- `playwright.config.ts` starts `pnpm dev` when `http://localhost:3000` is not
  reusable. If you see `Port 3000 is in use ... using available port 3001` or
  the app answers 500, restart the Compose app, poll `/` until it returns 200,
  then rerun. Do not start a second dev server. Never `pkill -f 'next dev'`:
  the Compose processes also match `/app/... next dev`, and the pattern can kill
  the calling shell.
- Large uncompressed HTTP responses are truncated near 25 KB in this sandbox.
  Use `curl --compressed` for styles, fixtures, and JSON. A plain fetch of the
  MapLibre demo style stopped at 25,275 bytes and failed JSON parsing; the
  compressed fetch returned 77,224 bytes.
- With the app running, request `/admin/login`, `/articles`, `/news`, and
  `/admin/collections/articles/create` once before `pnpm test:e2e`. The admin
  suites' `beforeAll` has a 30-second limit. The article block editor is a
  lazily compiled Next chunk: its first render takes over a minute cold and
  about a second once warm.
- The suites share one development database. Keep Vitest `fileParallelism: false`
  and Playwright `workers: 1`; parallel runs race on Payload's schema push and on
  published rows.
- Run one suite with a positional path, not `--`:
  `pnpm test:e2e tests/e2e/news.e2e.spec.ts`. With
  `pnpm test:e2e -- tests/e2e/news.e2e.spec.ts` the `--` is forwarded and every
  suite runs.

## MapLibre and browser-only code

- MapLibre GL JS v6 has no default export. Import the namespace behind the
  client-only `ServicePointsMapLoader` (`next/dynamic`, `ssr: false`).
- Keep `scripts/copy-maplibre-worker.mjs` wired into `postinstall`, `predev`, and
  `prebuild`, and keep `maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')`
  before map creation. Turbopack's generated worker URL 404s here.
- The committed test basemap is local (`public/map-style.json` and
  `public/world-countries.geojson`). Do not make e2e depend on an external style
  or tile provider.
- Assert function before pixels: canvas/region present, one marker per point,
  popup content, and mobile layout. Headless Chromium can paint only a 400×300
  corner of the WebGL canvas while the element is 1024×396 (observed here).
  After the functional assertions pass, record that limitation and check a real
  browser instead of iterating on headless screenshots.

## Admin E2E recipes

- Size timeouts to the failure you measured, never to hide one. The cold first
  block render needs an explicit expect timeout of up to ~180 s; everything else
  stays short, and a suite-level timeout above ~240 s just delays the diagnosis.
- Before asserting on unfamiliar admin markup, run a throwaway spec that dumps
  `outerHTML` (about 20 s) instead of guessing selectors inside a long-lived
  suite: two 600 s runs were spent waiting for selectors that never existed.
- `admin.condition` on a group or array child receives `(fullData, siblingData,
  args)`; test the second argument (`condition: (_data, siblingData) => …`).
  `(data) => data.enabled` never fires for a child field. See
  `.agents/skills/payload/reference/FIELDS.md` ("Sibling data condition").
- Playwright can beat admin hydration: a checkbox toggled before the form
  hydrates leaves React state unchanged, so dependent fields never appear. Wrap
  such toggles in `expect(async () => …).toPass()` instead of adding sleeps.
- Upload relationship fields render `Create New` / `Choose from existing` and,
  once selected, an SVG thumbnail plus a filename link — there is no
  `input[type="file"]` and no `<img>`. Drive them with `.upload__listToggler` →
  `.drawer__content tbody tr` → `button.default-cell__first-cell`, then assert
  the filename link.
- Host-run uploads land in `./media`, but the Compose app serves the `media`
  named volume. When an assertion or screenshot needs the file to be servable,
  upload through the running app (`POST /api/media` with a JWT) instead of the
  Local API.

## Content and access

- Content changes only through the Payload admin panel (`/admin`), enforced by collection access control rather than by hiding UI.
- The public frontend is strictly read-only: no forms, no client-side writes, no edit or delete controls.
- Anonymous reads of `articles` are limited to documents that are both published and past their `publishedAt`; authenticated users can also read drafts. `src/lib/articles.ts` reads with `overrideAccess: false` and no `_status` filter, so collection access stays the single gate.
- `service-points` is public read-only directory data: anonymous reads return every point, and create/update/delete require an authenticated administrator. `src/lib/service-points.ts` reads with `overrideAccess: false`.
- `article-attachments` (downloads) and `media` are public assets: anyone with the URL can fetch a file. Do not upload embargoed documents.
- `/articles` and `/news` are independent URL namespaces; the same slug can exist in both collections.

## Publishing workflow

- `articles` enables drafts and `versions.drafts.schedulePublish`.
- Scheduled publishing is a Payload job. A long-running app (Compose `app` or `pnpm dev`) drains the default queue every minute via `jobs.autoRun` in `src/payload.config.ts`; a serverless deployment needs an external cron that calls `POST /api/payload-jobs/run`.
- The attachment allowlist lives in `ARTICLE_ATTACHMENT_MIME_TYPES` in `src/collections/ArticleAttachments.ts` (PDF, Word, Excel, CSV, ZIP) and must match the README.

## Payload notes

- `slugField()` is not self-sufficient in Payload 3.93: the admin slug input
  starts locked, and the helper's hook runs after required-field validation, so a
  create that omits a slug fails. Keep a `beforeValidate` slug guard (see
  `src/collections/News.ts`) or pass an explicit slug.

## Where things live

- Payload config: `src/payload.config.ts`
- Collections: `src/collections/` (`Users.ts`, `Media.ts`, `ArticleAttachments.ts`, `Articles.ts`, `News.ts`, `ServicePoints.ts`)
- Article blocks and validators: `src/blocks/ArticleBlocks.ts`
- Public article reads: `src/lib/articles.ts`; pure helpers in `src/lib/article-utils.ts`
- Public news reads: `src/lib/news.ts`
- Public service point reads: `src/lib/service-points.ts`; pure helpers in `src/lib/service-point-utils.ts`
- Article components: `src/components/articles/` (block renderer, TOC, cards, pagination, client video facade)
- Frontend routes: `src/app/(frontend)/` (`news/`, `articles/`, `service-points/`)
- Article seeds and fixtures: `tests/helpers/seedArticles.ts`
- Service point map style and data: `public/map-style.json`, `public/world-countries.geojson`
- Service point seeds and fixtures: `tests/helpers/seedServicePoints.ts`

Agent skills: `.agents/skills/payload/SKILL.md` and `.agents/skills/commit/SKILL.md`.
