# Demo Site (Payload CMS)

A demonstration content site built on **Payload CMS 3** with a read-only public frontend and a fully admin-driven editing workflow. The site showcases four public sections — news, articles, service points on a map, and equipment sale listings — while all content changes are made exclusively through the Payload admin panel.

This project serves as a proof of concept for a content-first architecture where the public site is strictly read-only, and all data mutations are gated behind authentication and authorization.

## Features

- **News** — a collection of published news items with images, dates, and rich text.
- **Articles** — longer-form content with a separate model and layout: byline, hero image, tags, an ordered set of typed content blocks, a derived table of contents, reading time, downloadable attachments, related articles, and an optional video with a resilient preview.
- **Service Points** — a collection of dealer/service locations rendered as markers on a read-only MapLibre map page.
- **Equipment Listings** — sale announcements for used machinery, including photos, price, and condition.
- **Read-only public frontend** — no forms, no edit buttons, no direct API writes from the client.
- **Admin-only editing** — all create, update, and delete operations require an authenticated administrator.
- **Docker Compose** — a two-service stack (Payload app and PostgreSQL) where the database healthcheck gates application startup.
- **Persistent data** — database files and uploaded media live in named volumes and survive container restarts.

## Tech Stack

| Layer | Technology |
|---|---|
| CMS / Backend | Payload CMS 3 (TypeScript) |
| Frontend | Next.js (App Router), server-side rendering |
| Database | PostgreSQL |
| Map Integration | MapLibre GL JS |
| Containerization | Docker Compose |
| Package Manager | pnpm |

## Public routes

| Route | Collection | Purpose |
|---|---|---|
| `/news`, `/news/[slug]` | `news` | Short news items. |
| `/articles`, `/articles/[slug]` | `articles` | Long-form articles. |
| `/service-points` | `service-points` | Read-only map of dealers, service centres, and warehouses. |

News and articles use separate URL namespaces and separate collections. The same slug can exist in both, and `/articles/<slug>` and `/news/<slug>` always resolve to their own collection. Service points have no per-item route: the map page lists every point and shows its details in a marker popup.

## Articles

An article differs from a news item in both model and presentation:

- **Model** — an article carries a byline (`authorName`), an explicit `publishedAt` date, a summary, a hero image, indexed tags, an optional video, an ordered list of typed content blocks, downloadable attachments, per-article SEO overrides, and a public slug. A news item is a single title, date, image, and rich-text body.
- **Content blocks** — instead of one rich-text field, the body is a list of blocks: `section` (heading, `h2`/`h3` level, optional anchor, prose), `image`, `gallery`, `table`, `callout`, `footnotes`, and `downloads`.
- **Presentation** — `/articles` is a paginated, newest-first card list with poster and duration previews. `/articles/[slug]` renders a long-form layout with a sticky table of contents, reading time, tags, the block body, a downloads list, related articles, and canonical/Open Graph/Twitter metadata.
- **Derived values** — the table of contents is generated from the section headings (duplicate headings get `-2`, `-3` suffixes; headings without Latin characters fall back to `section-N`), and reading time is computed from the prose, table cells, captions, footnotes, and download labels at 200 words per minute.

Both sections follow the same access rules: anonymous visitors can read published content, and all writes require an authenticated administrator. Server-side reads in `src/lib/articles.ts` call the Local API with `overrideAccess: false`, so the collection's `read` access is the only gate — there is no second `_status` filter to drift out of sync with it.

### Video previews

YouTube may be blocked, throttled, or otherwise unreachable in the target region, so the article frontend never depends on a YouTube embed:

- The poster image, duration, external watch link, and alternative source link are rendered on the server, so they work with JavaScript disabled.
- No request reaches YouTube on the list page or on the first paint of the detail page. The `youtube-nocookie.com` iframe is only created after the visitor clicks the play control.
- If the iframe fails to load or does not report readiness within 8 seconds, the page shows an explicit error state and keeps the poster, duration, external link, and alternative source visible.
- When an alternative source is configured (`video/mp4`, `video/webm`, or `video/ogg`), the page can play it with a native `<video>` element instead of the embed.
- An enabled video that lacks a playable source, poster, or duration is rejected by field validation, and a persisted article in that state renders an "unavailable" message rather than a broken player.

### Attachments

Article downloads are uploaded to the separate `article-attachments` collection. To keep the evidence chain honest, note that these files are **public assets** exactly like media: anyone with the URL can download them, and the download list is not a per-article access gate. Do not upload embargoed or confidential documents.

The upload allowlist is defined in `src/collections/ArticleAttachments.ts`:

| Format | MIME type |
|---|---|
| PDF | `application/pdf` |
| Word (legacy) | `application/msword` |
| Word (OOXML) | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Excel (legacy) | `application/vnd.ms-excel` |
| Excel (OOXML) | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| CSV | `text/csv`, `application/csv` |
| ZIP | `application/zip`, `application/x-zip-compressed` |

Executables, HTML, and SVG are deliberately excluded because these files are served publicly. Files are written to `media/article-attachments/`; images keep using the `media` collection and `/api/media/file/**`.

The Compose stack stores uploads in the `media` named volume, not in the repo's
`./media` directory: files created by host-run scripts or tests are not served
by the container. Upload through the running app when a file must be reachable
at `/api/media/file/**`.

## Admin Panel and Content Management

All content is managed through the Payload admin panel at `/admin`.

After logging in, you can:
- Create and publish **news** items.
- Write and publish **articles**, including drafts, scheduled publishing, and revision history.
- Add **service points** with coordinates; they appear on the map immediately after page reload.
- Post **equipment listings** with photos and details.

The public frontend reflects changes on the next request; no build step is required for content updates.

### Drafts and scheduled publishing

The `articles` collection enables Payload drafts and `versions.drafts.schedulePublish`. Saving without publishing keeps the article out of the public site; the public pages only show `_status: published` articles whose `publishedAt` has already passed. Scheduling a future `publishedAt` therefore hides the article until that moment, and the publish menu's schedule action queues a Payload job that flips the document to published at the chosen time.

That job needs a queue runner:

- A long-running app process (the Compose `app` service or `pnpm dev`) runs the default queue every minute through `jobs.autoRun` in `src/payload.config.ts`.
- A serverless or otherwise short-lived deployment must call `POST /api/payload-jobs/run` from an external cron. Without a runner, scheduled articles stay unpublished.

After changing `src/payload.config.ts` or a collection, restart the app and rerun `pnpm generate:types` (and `pnpm generate:importmap` when adding admin components).

## Read-Only Frontend

The public-facing pages are strictly read-only:
- No forms that mutate data.
- No edit or delete buttons.
- No links that perform write operations.
- API endpoints reject unauthenticated `POST`, `PATCH`, and `DELETE` requests.

This is enforced at the Payload access-control layer and verified during development.

## Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. |
| `PAYLOAD_SECRET` | Payload signing secret. |
| `NEXT_PUBLIC_SERVER_URL` | Public origin used for article canonical, Open Graph, and Twitter URLs. |
| `NEXT_PUBLIC_MAP_STYLE_URL` | MapLibre style URL for `/service-points`. |

`NEXT_PUBLIC_SERVER_URL` falls back to `http://localhost:3000` when unset or malformed, so the local build still works without it. Set it to the real public origin in any deployment so absolute metadata URLs point at the deployed site. The frontend layout sets `metadataBase` from the same value.

`NEXT_PUBLIC_MAP_STYLE_URL` defaults to the bundled `/map-style.json` demo style, which draws Natural Earth country geometry from `/world-countries.geojson` and needs no API key or tile service. Replace it with any MapLibre-compatible style URL for a deployment; the production basemap provider remains a deployment decision. MapLibre renders the markers and popups on the client, and the same point details are server-rendered in a list below the map.

If the map is blank in development, confirm `public/maplibre-gl-worker.mjs` exists; `pnpm install`, `pnpm dev`, and `pnpm build` generate it from `maplibre-gl`.

## License

This project is for demonstration purposes. Refer to the repository’s license file for terms of use.
