# Proposal

## Why

The site still has no public content: the frontend is a neutral placeholder and Payload registers only `users` and `media`. News is the first of the four planned sections, and it needs a structured content model, a publication state that cannot leak drafts to visitors, and crawlable read-only pages. Without collection-level enforcement, "published only" would become an ad-hoc query on the frontend, and any forgotten filter would expose drafts or allow anonymous writes.

## What Changes

- **Add a `news` collection** with the fields a typical news item needs: `title` (required text), `slug` (required, unique, generated from the title for SEO-friendly URLs), `body` (required rich text), `publishedAt` (required date used for ordering and display), `listingDescription` (optional short text used in the list), and `image` (optional upload related to `media`). Admin list shows title, date, and publication status.
- **Use Payload's native draft/publish workflow** (`versions.drafts`) so `_status` has one precise meaning: `draft` is editor-only and `published` is public. Saving a draft never makes an item public; publishing does. A news item becomes visible immediately after the administrator publishes it, without a rebuild.
- **Enforce access at the collection level.** Unknown visitors may read only documents whose `_status` is `published`; authenticated administrators may read every document; `create`, `update`, and `delete` are rejected unless the request carries an authenticated administrator session. The public frontend gets no write path at all.
- **Add a read-only public news section**: `/news` renders the published list newest-first, and `/news/[slug]` renders a single published item with title, date, image, and body. Both are React Server Components rendered per request for SEO and freshness, include page metadata, and contain no forms, edit/delete controls, admin links, or client-side writes. Unpublished or unknown slugs return 404.
- **Link the new section from the home page** so visitors can reach it.
- **Verify the three required behaviors**: anonymous list/detail access, an item created and published in the admin appearing on the site immediately, and unauthorized REST calls to create, update, or delete being rejected without changing data.
- **Modify `project-baseline`**: its "Minimal runtime surface" requirement currently says exactly `users` and `media` are registered. That would forbid the first real collection, so it is relaxed to admit declared public-section collections while still banning example collections, seed data, and demo content.

This change touches the **news** public section only. Articles, service points on a map, and equipment listings are untouched.

## Capabilities

### New Capabilities

- `news`: the news content model, publication state, admin-only mutations, published-only public reads, and the read-only server-rendered list and detail pages.

### Modified Capabilities

- `project-baseline`: the "Minimal runtime surface" requirement changes from "exactly `users` and `media`" to a product-surface rule that permits the `news` collection as the first declared public-section collection, while keeping the ban on example collections, seed data, demo routes, and demo content.

## Impact

- **Added**: `src/collections/News.ts`, a public news data-access module under `src/lib/`, `/news` and `/news/[slug]` server components, and news-specific integration and end-to-end tests.
- **Modified**: `src/payload.config.ts` (register `news`), `src/app/(frontend)/page.tsx` (link to `/news`), generated `src/payload-types.ts`, `AGENTS.md` (no longer says every public section is missing), and the `project-baseline` delta spec. Uploaded media continues to use the existing `media` collection and its `/api/media/file/**` pattern.
- **APIs**: `GET /api/news` and `GET /api/news/:id` return published documents to unauthenticated callers; `POST`, `PATCH`, and `DELETE` require an authenticated administrator session and are rejected otherwise. No new endpoints, roles, dependencies, or environment variables.
- **Database**: one new `news` table plus its version table, created by the Postgres adapter's schema push in development; no hand-written migration.
- **Out of scope**: the other three public sections and any map provider; pagination, search, categories/tags, authors as a separate concept, comments, likes, RSS/sitemap, scheduled publishing, localization, public draft preview, additional administrator roles, frontend editing in any form, and production CDN/cache tuning.
