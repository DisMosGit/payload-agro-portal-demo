# Design

## Context

The project currently has one public content section, news, backed by the `news` collection and the server-rendered `/news` routes. Its public read helper deliberately uses `overrideAccess: false` without a `_status` filter so the collection's access rule is the single gate for drafts. Media uploads are public to read and authenticated to write. The public frontend has no forms or mutation code.

The article section must reuse those access and read-only principles without inheriting news's flat content model or presentation. It also introduces a third-party dependency (YouTube) that may be blocked or throttled, plus scheduled publishing, which needs Payload's jobs runner. See `proposal.md` for motivation and `specs/articles/spec.md` for required behavior.

## Goals / Non-Goals

**Goals:**

- Add a distinct `articles` content model, admin experience, and public presentation.
- Keep article reads and writes governed by collection access control, never by UI-only checks.
- Make YouTube an optional enhancement: the page's useful content and fallback links must survive without it.
- Generate the table of contents and reading time on the server from structured article data.
- Support draft, published, and scheduled states with native Payload behavior.
- Keep article URLs and queries isolated from news.

**Non-Goals:**

- Reader accounts, comments, reactions, or any public mutation.
- A generic raw-HTML or arbitrary-iframe block.
- Video transcoding, upload, or hosting; the alternative source is a configured direct URL.
- Full-text search, tag archive pages, localization, or analytics.
- Any change to news, service points, equipment listings, or the map provider.

## Decisions

### 1. Separate collection and route namespace

Use a new `articles` collection and the top-level `/articles` and `/articles/[slug]` routes. Do not add article fields to `news`, reuse the news read helper, or place articles under `/news/articles`.

This keeps the data model, access rules, slug uniqueness, sorting, and presentation independent. A shared slug is legal across the two collections because the URL spaces are different; tests must prove that `/articles/<slug>` and `/news/<slug>` resolve independently.

### 2. Article schema

`src/collections/Articles.ts` uses the existing `slugField()` plus the same `beforeValidate` slug guard as `News.ts`. Payload 3.93's slug helper starts locked and does not fill the field before required validation, so a title-only create would otherwise fail. The guard fills a slug only on create when no slug is supplied and never rewrites an explicit or existing slug.

The model is intentionally richer than news:

| Area | Fields | Purpose |
| --- | --- | --- |
| Identity | `title`, `slug`, `summary` | List cards, URL, SEO fallback |
| Attribution | `authorName`, `publishedAt` | Byline and date metadata; `publishedAt` also orders the list |
| Visual | `heroImage` | Detail hero and social-image fallback |
| Discovery | `tags` (indexed text array) | Related articles and list metadata |
| Video | `video` group: enabled flag, YouTube URL, title, poster, duration, external URL, alternative source URL/MIME type | Resilient preview metadata |
| Body | `content` blocks | Structured long-form material |
| SEO | optional `seo` group: meta title, meta description, social image | Overrides for derived metadata |

`publishedAt` remains the display and ordering date. The native scheduled-publish control is separate and flips status through a job; authors should set `publishedAt` to the intended public date.

Register `article-attachments` before `articles` in `payload.config.ts`, then `articles`, so the relationship target is visible in the configuration.

### 3. Structured blocks, not one rich-text blob

`src/blocks/ArticleBlocks.ts` defines inline blocks used by `Articles.content`:

- `section`: required heading, heading level (`h2`/`h3`), optional anchor override, and required rich text. Sections are the only source of table-of-contents entries.
- `image`: required media upload, caption, credit, and normal/wide presentation.
- `gallery`: one or more images, each with a caption, rendered as a no-JavaScript grid.
- `table`: caption, explicit column labels, and rows of text cells. Cell counts are validated against the column count.
- `callout`: variant (`info`, `warning`, `success`), title, and rich text.
- `footnotes`: ordered notes with stable anchors.
- `downloads`: one or more items, each with an `article-attachments` file, label, and optional description.

The article rich-text fields use a restricted Lexical editor: paragraphs, inline formatting, links, lists, and blockquotes only. Headings belong to section blocks, and tables/uploads belong to their dedicated blocks. This avoids two competing sources of headings and prevents rich text from smuggling in unsupported media or table markup.

Alternative considered: one rich-text body with arbitrary headings and embedded uploads. Rejected because the table of contents would have to parse Lexical nodes, anchors would be unstable, and the block-level safety and fallback rules would be harder to enforce.

### 4. TOC anchors and reading time

`src/lib/articles.ts` derives the table of contents from `section` blocks in array order:

1. Use the section's optional anchor override, otherwise slugify the heading text.
2. Fall back to `section-<position>` when slugification produces an empty string.
3. Deduplicate repeated anchors with a numeric suffix so every link is unique.
4. Render each heading with the resulting `id`, and each TOC entry as `<a href="#anchor">`.

The TOC is server-rendered and needs no client JavaScript. A section without a heading cannot exist because the field is required.

Reading time is derived, not stored, so it cannot drift from the body. Concatenate plaintext from section and callout rich text plus table cell text, count whitespace-separated words, divide by 200 words per minute, round up, and clamp to at least one minute. `convertLexicalToPlaintext` from the already-installed Lexical package performs the rich-text extraction. A conversion failure falls back to one minute rather than failing the page.

### 5. Video fallback architecture

The video model is normalized on the server into one of three states:

- `none`: no video configured; render no video area.
- `ready`: a playable YouTube URL or alternative source, plus the metadata needed for a meaningful preview.
- `incomplete`: partially configured or a referenced poster is missing; render an explicit "Video unavailable" state.

The list page renders only a server-side poster card: poster (or a styled text placeholder), duration badge, video title, and a link to the article. It makes no YouTube request. The detail page uses a small `'use client'` component at `src/components/articles/VideoPreview.tsx` for the optional inline player, surrounded by server-rendered fallback links that never depend on client state.

The interaction is progressive enhancement:

- The initial server HTML contains the poster, duration, external link, and alternative-source link. The play control is an actual anchor whose `href` points at the external or alternative source.
- Without JavaScript, activating the control follows that link. The page is still complete.
- With JavaScript, activating the control prevents navigation, sets a loading state, and inserts the YouTube `youtube-nocookie.com` iframe.
- An iframe load clears the timer and shows the embed. An iframe error or an eight-second timeout sets an explicit unavailable state while keeping the poster and fallback links visible.
- The fallback panel is always present, not only after failure, because cross-origin frames cannot reliably report blocked pages or playback errors. The copy explains that the video may be unavailable in the region and offers the external and alternative links.
- If no YouTube source is configured but a direct alternative source exists, the page renders a native `<video controls poster>` element or a direct link, with no third-party dependency.

The client component only changes local presentation state. It does not fetch data, post to the API, or expose any edit action.

Alternative considered: auto-loading the YouTube iframe. Rejected because a blocked or throttled embed would delay or break the page and make YouTube a hard dependency. The facade also avoids unnecessary third-party requests on the list.

### 6. Access control and query discipline

The article collection mirrors the news boundary:

```ts
read: ({ req: { user } }) => {
  if (user) return true

  const now = new Date().toISOString()

  return {
    and: [
      { _status: { equals: 'published' } },
      { publishedAt: { less_than_equal: now } },
    ],
  }
}
```

`create`, `update`, and `delete` return `Boolean(user)`. The date condition is defense in depth: it prevents a future-dated article that was accidentally marked published from appearing before its date, and it makes the public gate testable without waiting for a scheduled job. Native scheduled publishing remains the mechanism that changes status at the scheduled time.

`src/lib/articles.ts` uses `getPayload`, `overrideAccess: false`, and no `_status` filter, matching the news helper. The collection rule is the only public-read gate. This applies to the list, direct slug lookup, and related-article queries.

`ArticleAttachments` has public `read` because published downloads must be servable, and `Boolean(user)` for create/update/delete. It restricts uploads to document MIME types and requires a title. Media remains the image store. Both are public asset collections, so attachments are not individually gated by their article's status; see the risk below.

The frontend has no custom write endpoints, server actions, mutation forms, or client fetches. The only client component is the video facade, which holds local UI state.

### 7. Scheduled publishing

`Articles.versions` is `{ drafts: { schedulePublish: true } }`, which enables the native Save Draft, Publish, Unpublish, and Schedule Publish controls. Payload creates a `schedulePublish` job with a `waitUntil` time.

Scheduled publishing needs a jobs runner. `payload.config.ts` gets:

```ts
jobs: {
  autoRun: [{ cron: '* * * * *', queue: 'default' }],
}
```

The scheduled-publish task is registered automatically by Payload; do not add a custom scheduler or duplicate task. `autoRun` requires a long-running process, which the Compose stack and `pnpm dev` provide. A serverless deployment would need an external cron call to `/api/payload-jobs/run` or the equivalent bin command. The schedule UI is not useful without a runner, so this is part of the change rather than deployment trivia.

The public date gate and the native status job are complementary: the job makes the article publishable, and the date gate prevents premature display of a future `publishedAt`.

### 8. Public reads and rendering

Routes:

- `src/app/(frontend)/articles/page.tsx`: `dynamic = 'force-dynamic'`, page size 9, reads `?page=N`, clamps invalid pages, sorts by `-publishedAt` then `-createdAt`, and renders server-side cards and page links.
- `src/app/(frontend)/articles/[slug]/page.tsx`: `dynamic = 'force-dynamic'`, looks up by slug, calls `notFound()` for an unpublished or unknown slug, and renders the full article.
- `src/app/(frontend)/articles/articles.module.css`: a long-form reading layout distinct from the news card layout, with a sticky TOC on wide screens and a stacked layout on narrow screens.

Read depths:

- List: `depth: 1` for hero and video-poster uploads.
- Detail: `depth: 2` for block images, galleries, posters, and attachment documents.
- Related: `depth: 1`, one query with shared tags, excluding the current article and limiting to three. If no tag matches, fall back to recent published articles. The same access rule filters drafts and future dates.

`cache` from React wraps the per-request lookups so metadata and page rendering do not fetch twice. The pages remain dynamic, so publishing changes are visible on the next request without revalidation plumbing.

### 9. Safe block rendering

A discriminated renderer maps known block types to components. Unknown block types are skipped. There is no `dangerouslySetInnerHTML`; text, captions, table cells, callout titles, and footnotes render as React children and are escaped by React. Media and attachment relationships are checked for populated objects before use, so missing files render an unavailable state instead of throwing.

Table cells are plain text, not rich HTML. Galleries and images use the media document's `alt` text and require captions only as authored. Attachment links use the upload document's URL, filename, MIME type, and size; a missing URL produces "Attachment unavailable". Link URLs for the video and external sources are validated to `http:`/`https:` before rendering.

### 10. SEO and canonical URLs

The root frontend layout sets `metadataBase` from `NEXT_PUBLIC_SERVER_URL`, falling back to `http://localhost:3000` for local development. The article detail page builds:

- `title`: SEO meta title, then article title.
- `description`: SEO meta description, then summary, then a plaintext excerpt.
- `alternates.canonical`: `/articles/<slug>`.
- `openGraph`: `type: 'article'`, article title/description, publication time, authors, tags, and the SEO social image, hero image, or video poster.
- `twitter`: `summary_large_image` with the same image.
- `robots`: index/follow for published content; noindex behavior for not-found metadata.

The list page supplies its own description and a canonical path, including `?page=N` for paginated pages. Metadata is generated from the same access-controlled lookup, so a draft or future article cannot leak its title or description through metadata.

### 11. Admin experience and validation

- `Articles.admin.useAsTitle` is `title`; default columns are title, byline, publication date, and status.
- Required fields are title, byline, publication date, and at least one content block. Summary, hero, tags, SEO, and video are optional.
- When the video is enabled, validation requires a playable source (YouTube URL or alternative source), poster, and duration. The external link can be an explicit URL or derived from the YouTube watch URL. Invalid YouTube URLs or non-HTTP(S) links are rejected. This keeps the normal case complete while the frontend still fails closed if media is later deleted.
- Scheduled publishing and drafts use Payload's native controls; no custom admin actions are added.
- `ArticleAttachments` has a title, description, document-only MIME allowlist, and default columns showing title, filename, MIME type, size, and updated date.

### 12. Verification strategy

**Integration (Vitest)**

- Seed published, draft, future-dated, and admin-only articles; assert anonymous reads return only published articles whose date has passed, including when `draft: true` is requested.
- Assert anonymous create, update, delete, and attachment upload are rejected and leave data unchanged; assert authenticated administrator operations succeed.
- Unit-test anchor generation (duplicates, punctuation, non-ASCII, empty headings), reading-time calculation, YouTube URL parsing, video state normalization, and attachment metadata fallback.

**End-to-end (Playwright)**

- Create an article through the admin UI, publish it, and confirm it appears on `/articles` and `/articles/<slug>` on the next request. Edit and unpublish it and confirm the changes.
- Schedule an article for the near future, confirm it is absent before the scheduled time, and confirm the scheduled state is visible in the admin. Use a short future time and poll the jobs runner or admin status for the transition; do not rely on a one-minute cron tick in the assertion.
- Load `/articles` with JavaScript disabled and verify titles, summaries, pagination, poster previews, and durations are already in the HTML.
- Load a published article with JavaScript disabled and verify TOC links, sections, table, callout, footnotes, gallery, attachment link, related articles, and metadata.
- Intercept and abort YouTube requests, activate the preview, and assert the informative fallback state and external/alternative links remain; also verify no YouTube request occurs before activation.
- Seed script-like text and a missing media reference in a block, then assert the text is escaped, no executable markup is introduced, and the page still returns 200.
- Create an article and a news item with the same slug; assert `/articles/<slug>` and `/news/<slug>` show different content and neither list includes the other collection.
- Assert article pages contain no forms, comment UI, edit/delete controls, or admin links.

**Commands and prerequisites**

- Install the browser once: `pnpm exec playwright install chromium`.
- Restart the dev server after `payload.config.ts` or collection changes.
- Request `/admin/login`, `/news`, and `/articles` once before E2E; the admin suite's `beforeAll` has a 30-second limit.
- Keep `fileParallelism: false` and `workers: 1`; the suites share one database.
- Run individual suites with positional paths, for example `pnpm test:e2e tests/e2e/articles.e2e.spec.ts`.
- Regenerate `src/payload-types.ts` and `src/app/(payload)/admin/importMap.js`; never hand-edit them.
- Keep `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test:int`, and the article E2E suites green.

## Risks / Trade-offs

- **YouTube can still paint an error inside a loaded iframe** → Cross-origin frames cannot reliably report playback failure. The fallback links are always visible, and a timeout/error triggers the explicit unavailable state. The page never depends on the iframe succeeding.
- **No-JavaScript visitors cannot play the inline YouTube facade** → The play control is an anchor, so they can still open the external or alternative source. Poster and metadata remain visible.
- **Scheduled publishing silently does nothing without a jobs runner** → `jobs.autoRun` is part of the implementation, and deployment documentation calls out the long-running-process requirement.
- **Public attachment files are not gated per article** → The article record and its metadata are access-controlled, but the upload collection is a public asset store like media. Do not upload embargoed files; if per-article file confidentiality becomes a requirement, add an authenticated download gateway in a later change.
- **Explicit section headings limit authoring flexibility** → Authors cannot add arbitrary headings inside a rich-text block. This is deliberate: it keeps TOC anchors deterministic and prevents headings from bypassing the structured content model.
- **Reading time is approximate** → It is derived from prose and table text at 200 words per minute. The spec requires an estimate, not a precise measure.
- **Attachments MIME allowlist may reject legitimate formats** → Start with PDF, Word, Excel, CSV, and ZIP; extend the allowlist only after deciding that the new format is safe to serve publicly.
- **Canonical URLs depend on configuration** → `NEXT_PUBLIC_SERVER_URL` must be set in deployed environments; the localhost fallback is for development only.
- **Multiple app instances may run jobs** → Payload's job queue prevents duplicate execution; deploy one scheduler or use the documented bin/cron pattern for larger deployments.

## Migration Plan

1. Add the `article-attachments` and `articles` collections, block definitions, jobs configuration, public routes, library code, and components.
2. Restart the development server so Payload registers the new collections, then regenerate types and the admin import map.
3. Let Payload's development schema push create the new tables and `_status`/version tables. There is no existing article data to migrate.
4. Add `NEXT_PUBLIC_SERVER_URL` to `.env.example` and the deployment environment; local development can use the fallback.
5. Run the integration and E2E suites, then inspect `/admin/collections/articles` and `/articles` manually.
6. For a production database, generate and review a Payload migration before deploying instead of relying on schema push. Rollback is removal of the new routes and collections; existing news data is untouched, and article tables can be dropped only after confirming no content must be retained.

## Open Questions

- The map provider remains undecided. Service points and map rendering are outside this change, so no provider is selected or assumed here.
