# Design

## Context

See `proposal.md` — Why. Current state that shapes the approach:

- Payload 3.93 on the Next.js 16.4 App Router with PostgreSQL. `src/payload.config.ts` registers only `Users` (auth) and `Media` (public-read uploads), and the root editor is `lexicalEditor()`.
- The public frontend is a single static home page in `src/app/(frontend)/`. The admin and the Payload REST/GraphQL routes live in `src/app/(payload)/`; the REST route already exposes `/api/*`, so no custom route handler is needed for news.
- `next.config.ts` already allows `next/image` for `/api/media/file/**`, so uploaded images can be rendered without a config change.
- The Local API bypasses access control by default (`overrideAccess: true`). The frontend read path therefore has to opt in to enforcement explicitly; this is the main security trap of the change.
- The `project-baseline` spec currently requires "exactly `users` and `media`"; the delta spec relaxes that rule for declared public-section collections.
- There is no styling framework, no pagination pattern, and no custom admin components. Playwright and Vitest are already wired, and the Playwright `webServer` starts `pnpm dev` against the same PostgreSQL database.

## Goals / Non-Goals

**Goals:**

- One collection-level access model that is the only gate for both API and frontend reads.
- A public read path that cannot accidentally fetch drafts, even if a page author forgets a filter.
- Server-rendered pages that reflect an admin publish on the very next request.
- Verification that exercises the real HTTP API and the real admin UI, not only Local API calls.

**Non-Goals:**

- Designing a visual system, custom admin views, or rich-text block components.
- Pagination, search, categories, authors, scheduled publishing, or draft preview links.
- Changing the `media` collection, authentication, or administrator roles.
- Production database migrations or CDN/cache strategy.

## Decisions

### D1 — Collection schema in `src/collections/News.ts`

The `news` collection has this field set:

| Field | Type | Rules | Purpose |
| --- | --- | --- | --- |
| `title` | text | required | Admin title and page heading |
| `slug` | text via `slugField()` | required, unique, generated from `title` | SEO URL `/news/<slug>` |
| `listingDescription` | textarea | optional, max 300 characters | Short text for the list; falls back to a body excerpt |
| `body` | richText (Lexical) | required on publish | Full item text |
| `publishedAt` | date | required, defaults to now, `dayAndTime` picker | Display date and sort key |
| `image` | upload → `media` | optional | Lead image |

Collection-level settings: `slug: 'news'`, `admin.useAsTitle: 'title'`, `admin.defaultColumns: ['title', 'publishedAt', '_status']`, `defaultSort: '-publishedAt'`, `versions: { drafts: true }`.

`slugField()` supplies the admin Generate/Lock control and the unique index. Its own field hook does not run early enough to satisfy the required check on a programmatic create, so a collection `beforeValidate` hook fills a missing slug from the title. An explicitly supplied slug is preserved, and the slug stabilises after creation because the helper stores `generateSlug: false` once a slug exists.

Rationale: this is the smallest model that satisfies every requested element while keeping the URL stable. `listingDescription` is deliberately optional because the request said "possibly"; the list falls back to plain text extracted from the body. `image` is optional so an item can be published before artwork exists; the pages simply omit the image. `publishedAt` is a separate field rather than `createdAt` so editors can backdate or choose the publication date, and the list sorts on editorial time rather than database time.

Alternatives considered:

- Plain `textarea` body — simpler to render, but the project already ships the Lexical editor and a news item is expected to carry paragraphs, headings, and links. Rich text is the better fit.
- Document ID in the URL — stable but poor for SEO and human-readable links; rejected.
- A hand-rolled slug hook — avoids the experimental `slugField()` helper, but reimplements generation, freezing on update, and uniqueness. `slugField()` is the built-in path and is isolated to one line, so it can be replaced later if its API changes.

### D2 — Publication state uses Payload's native drafts

Enabling `versions.drafts` gives the collection `_status` with `draft`, `published`, and `changed`. New items start as drafts; the admin panel exposes Save Draft and Publish. Only publishing makes an item public. A saved-but-unpublished draft is never visible, even if it is valid.

Rationale: the requirement says "published news"; native drafts make that a first-class state with version history and the standard admin publish workflow. It also means the public visibility rule is a status predicate, not an editorial convention.

Alternative: a custom `status` select with `draft`/`published`. It looks simpler, but it duplicates a concept Payload already models, loses version history and publish validation, and requires every read path to remember the filter. Rejected.

Consequence to state plainly: "appears immediately after saving" in the acceptance criteria means **after Publish**. Saving a draft is intentionally not public. The verification tasks test Publish, not Save Draft.

### D3 — Access control matrix

All access lives on the collection:

```ts
read: ({ req: { user } }) =>
  user ? true : { _status: { equals: 'published' } },
create: ({ req: { user } }) => Boolean(user),
update: ({ req: { user } }) => Boolean(user),
delete: ({ req: { user } }) => Boolean(user),
```

- Anonymous `read` returns a query constraint, not `false`, so an anonymous list request returns published documents and nothing else. The same constraint is applied to a single-document request, so a draft's detail URL resolves to no document and the page returns 404.
- Authenticated `read` is `true`: the admin list and edit views must see drafts. There is no separate editor role; `Users` is the only auth collection, so "authenticated" and "administrator" are the same set.
- Mutations return a boolean. There is no public create/update/delete path in the frontend, and the REST/GraphQL APIs inherit the same functions.
- `access.admin` is left at its default (authenticated users only), and no field-level access is added: once an item is published, every field is public by definition, and the related `media` documents are already publicly readable.
- No hook rewrites or filters data; access control is the single enforcement point, as the project rules require.

### D4 — Frontend reads go through the Local API with `overrideAccess: false`

A server-only module `src/lib/news.ts` owns all public reads:

- `getPublishedNews()` calls `payload.find({ collection: 'news', overrideAccess: false, depth: 1, pagination: false, sort: ['-publishedAt', '-createdAt'] })`.
- `getPublishedNewsBySlug(slug)` calls `payload.find({ collection: 'news', where: { slug: { equals: slug } }, limit: 1, depth: 1, overrideAccess: false })` and returns the first document or `null`.
- Both are wrapped in React's `cache()` so a detail page's `generateMetadata` and page component share one query per request.
- The `news` slug type comes from the generated `News` type in `src/payload-types.ts`.

Rationale: `overrideAccess: false` makes the collection's access functions run for an anonymous request, so the published-only rule in D3 is enforced once, in the same place as the API. The helper deliberately does **not** add its own `_status` filter; duplicating the predicate would hide a broken access rule instead of failing the test that guards it. `depth: 1` populates the image; `pagination: false` returns all published items rather than Payload's default of 10, which would silently truncate the list.

Alternatives considered:

- HTTP `fetch('/api/news')` from the server component — correct access enforcement but adds a network hop, loses end-to-end TypeScript types, and complicates metadata reuse. Rejected for a same-process CMS.
- Local API with the default `overrideAccess: true` plus an explicit `where: { _status: ... }` — works until a page forgets the filter, and then drafts leak. Rejected; defense belongs in the collection, not in each page.
- Using `findByID` after a separate slug lookup — the lookup itself would be an unguarded read. Rejected.

### D5 — Both pages are dynamically server-rendered

`/news` and `/news/[slug]` are React Server Components with `export const dynamic = 'force-dynamic'`. They do not use `use client`, server actions, route handlers, or client-side fetching. The detail page also implements `generateMetadata` and awaits the Next 16 `params` promise (`params: Promise<{ slug: string }>`), then calls `notFound()` when the helper returns `null`.

Rationale: without a dynamic marker, Next may prerender the routes at build time against an empty or stale database, which would make verification (b) fail until a rebuild. Forcing dynamic rendering makes the next request after Publish read the database, while still delivering complete HTML for crawlers. The feed is small; the cost is one database query per request.

Alternatives considered:

- Static generation plus `revalidatePath` hooks in `afterChange`/`afterDelete` — more moving parts, and a failed or bypassed hook leaves a stale public page. It becomes the right choice when traffic justifies caching; not now.
- A fixed `revalidate` interval — introduces a window in which a published item is not on the site, contradicting "immediately". Rejected.

### D6 — Page composition and presentation

- `/news`: a page heading, short intro, and an ordered list of `<article>` cards. Each card links to `/news/<slug>` and shows the image (when present), title, `<time dateTime>` publication date, and `listingDescription` or a plain-text body excerpt. An empty-state message is rendered when nothing is published.
- `/news/[slug]`: a back link to `/news`, title, date, image when present, and the full body rendered with `RichText` from `@payloadcms/richtext-lexical/react` (server-compatible, no client bundle). Unknown or draft slugs return the framework 404.
- Images use `next/image` with the media document's `width`/`height` and `alt`; the existing `localPatterns` entry already permits `/api/media/file/**`. No image is rendered when the field is empty, and no placeholder binary is added.
- Dates use one shared formatter (`en-GB`, UTC, long day/month/year) so server output is deterministic and does not depend on the host time zone.
- A small CSS module provides spacing and readable line lengths; no design system or new dependency is introduced.
- Neither page renders a form, a button, an edit/delete control, an admin link, or any write-capable client code. Navigation is limited to home, the list, and item links. The home page gains a link to `/news`.

### D7 — Generated artifacts and database schema

`News` is imported and added to `collections` in `src/payload.config.ts`. After that, `pnpm generate:types` regenerates `src/payload-types.ts`, and `pnpm generate:importmap` is run even though no custom admin component is added. Neither generated file is hand-edited.

The Postgres adapter's development schema push creates the `news` table and its versions table when the app or integration tests boot. This change does not author a migration; a production deployment would need one, which is out of scope and recorded as a risk.

### D8 — Verification design

The three required checks map to automated tests plus direct HTTP checks:

1. **Anonymous read (a)** — an integration test seeds one published and one draft item through the trusted Local API, then calls `getPublishedNews`/the Local API with `overrideAccess: false` and asserts only the published item is returned. A Playwright test runs in a context with JavaScript disabled, loads `/news`, asserts the published title and link are present and the draft title is absent, opens the detail page, and asserts the full body is present. It also asserts the HTML contains no `<form>`, no edit/delete controls, and no `href="/admin"`. A direct `curl -i /news` and `/news/<slug>` check confirms 200 and server-rendered content.
2. **Admin publish → immediate public visibility (b)** — a Playwright test signs in with the existing admin helper, creates a news item through the admin UI (title, body, date, optional description/image), clicks Publish, then opens `/news` and `/news/<slug>` in a fresh anonymous context and asserts the item is visible without a rebuild or server restart. A follow-up edit is checked the same way, and unpublishing makes the detail 404.
3. **Unauthorized writes (c)** — a Playwright API test (or equivalent `curl` sequence) sends `POST /api/news`, `PATCH /api/news/:id`, and `DELETE /api/news/:id` with no session cookie, asserts a 401/403 authorization response, and then reads the collection back to prove the document count and content did not change. An integration test repeats the same operations through the Local API with `overrideAccess: false` and no user, asserting they reject.
4. **Gates** — `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test:int`, and `pnpm test:e2e` must pass, per the project guidance. The test database must be reachable, and Playwright Chromium must be installed before the e2e run.

Test hygiene: item slugs include a per-run suffix to avoid unique collisions, and created documents/users are deleted in `afterAll` so repeated runs do not accumulate data. The existing `tests/helpers/login.ts` and `seedUser.ts` are reused rather than duplicated.

### D9 — Documentation touch

`AGENTS.md` currently states that none of the four public sections is implemented. It is updated to say news is implemented and the other three are not, and to name the collection and the two public routes. `README.md` already describes news as a feature and needs no change. No dependency, environment variable, or Compose change is required.

## Risks / Trade-offs

- **Draft semantics vs. "after saving"** → The acceptance wording is interpreted as "after Publish". Verification and docs must say Publish explicitly; draft saves are intentionally invisible.
- **`force-dynamic` queries the database on every request** → Acceptable for a demo with a small published set; if traffic grows, move to cached rendering plus `revalidatePath` hooks and keep the access rule unchanged.
- **No pagination (`pagination: false`)** → The list is unbounded. Fine for a demo; pagination is a follow-up that changes the list spec, not the access model.
- **`slugField()` is marked experimental** → It is the built-in helper and is isolated to one field; the collection `beforeValidate` guard covers programmatic creates that omit a slug. If the helper breaks, replace the field with a small slug input plus the existing guard hook without changing the spec.
- **Local API bypass is easy to reintroduce** → Any new helper using the default `overrideAccess: true` would leak drafts. Mitigation: the server-only news module is the only public data path, and an integration test asserts anonymous reads exclude drafts.
- **Playwright automation of the Lexical editor can be brittle** → Fill title/date/description through normal inputs and the body through the editor's contenteditable; if the editor interaction proves flaky, create/publish the item through the authenticated REST API with the admin session cookie and still verify the admin UI renders the collection. The public-visibility assertion (b) remains the same.
- **Test data in a shared development database** → Unique per-run slugs plus `afterAll` cleanup; the integration test uses its own documents and removes them.
- **Schema push instead of a migration** → Convenient in development, not a production deployment strategy. A follow-up must generate and review a Postgres migration before production.
- **Rich text rendering through a library converter** → Trusted admin-authored content; `RichText` produces React elements rather than an HTML string, avoiding `dangerouslySetInnerHTML`. Custom HTML blocks are not enabled.
- **Image dimensions** → `next/image` needs `width`/`height`; media documents provide them after upload. If a media document is missing dimensions, fall back to omitting the optimized image rather than crashing the page.

## Migration Plan

1. Add `src/collections/News.ts` and register it in `src/payload.config.ts`.
2. Run `pnpm generate:types` and `pnpm generate:importmap`.
3. Boot the app or run `pnpm test:int` once so the Postgres adapter pushes the `news` and `_news_v` tables.
4. Add the server-only news data module, the two routes, and the home link.
5. Add the tests and update `AGENTS.md`; run the verification ladder.
6. Manually spot-check with the dev server: anonymous list/detail, admin publish visibility, and unauthenticated write rejection.

Rollback: remove the two routes, the helper, and the `News` registration, regenerate types, and drop the `news`/`_news_v` tables (or restore the pre-change database). There is no production data or migration in this change, so no data backfill is needed.

## Open Questions

- **Map provider** — still undecided and explicitly out of scope here; no map, tile, or geocoding choice is assumed by the news work.
- **News list pagination and search** — deferred; the current list returns all published items newest-first.
- **Presentation locale and time zone** — the design uses `en-GB`/UTC for deterministic output; localizing dates and copy is a separate decision.
- **Authors** — items have no author relationship; whether an editor should be credited is deferred.
- **Production migrations** — the project still needs a migration workflow before a non-development deployment.
