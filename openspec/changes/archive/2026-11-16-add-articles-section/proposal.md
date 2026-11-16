# Proposal

## Why

News covers short announcements, but the site needs a separate long-form section for in-depth material with structured sections, media, and downloads. Articles must remain readable when YouTube is blocked or throttled, and all authoring must stay inside the authenticated Payload admin while the public frontend remains strictly read-only.

## What Changes

- Add an `articles` collection with a richer model than news: unique slug, summary, byline and publication date, hero image, tags, reading-time inputs, resilient video metadata, structured content blocks, and draft/published states with scheduled publishing.
- Add an `article-attachments` upload collection for downloadable files, restricted to document MIME types, with public reads and admin-only writes.
- Add a public `/articles` list page with pagination, article cards, tag and reading metadata, and video poster previews.
- Add a public `/articles/[slug]` detail page with a generated table of contents, reading time, author/date metadata, structured blocks, downloads, related articles, and SEO metadata with canonical URLs.
- Add structured article blocks: section (heading plus rich text), image with caption, gallery, table, callout, footnotes, and downloadable attachments.
- Add a video presentation that never depends on YouTube loading: server-rendered poster, duration, external link, and optional alternative direct video source; the YouTube iframe is loaded only after a deliberate visitor action and has a timeout/error fallback.
- Enable Payload's native scheduled publishing for articles, including the jobs auto-run configuration it requires.
- Update the Payload config, home navigation, project documentation, and the project baseline spec to reflect the new article surface.

Public section touched: **articles**. News, service points, equipment listings, and the map are not changed.

Out of scope:

- Comments, reactions, reader accounts, submissions, and any public write or edit path.
- Arbitrary raw HTML or third-party iframe embeds; only the configured YouTube facade and validated direct video/poster URLs are supported.
- Video transcoding, hosting, or automatic upload of video files; an alternative source is a configured direct URL.
- Full-text search, localization, analytics, newsletter integration, and migration of existing news into articles.
- Changes to the map provider, service points, or equipment listings.

## Capabilities

### New Capabilities

- `articles`: Long-form article authoring, access control, scheduled publishing, structured content rendering, video fallback, table of contents, related articles, pagination, and SEO for the public `/articles` section.

### Modified Capabilities

- `project-baseline`: The minimal runtime surface now registers `articles` and `article-attachments` alongside `users`, `media`, and `news`; the existing read-only public frontend and admin-only mutation guarantees continue to apply to the new section.

## Impact

- **Payload collections:** `src/collections/Articles.ts`, `src/collections/ArticleAttachments.ts`, shared block definitions under `src/blocks/`, and `src/payload.config.ts`.
- **Public reads and rendering:** new `src/lib/articles.ts`; new routes under `src/app/(frontend)/articles/`; new article components for cards, body blocks, TOC, video facade, downloads, pagination, and related articles.
- **Configuration:** `jobs.autoRun` for scheduled publishing and a site URL environment variable for canonical/Open Graph URLs.
- **Generated artifacts:** `src/payload-types.ts` and `src/app/(payload)/admin/importMap.js` must be regenerated, never hand-edited.
- **Tests:** new integration coverage for article/attachment access and new E2E coverage for admin publishing, public list/detail rendering, video degradation, block safety, pagination/related content, and route isolation from `/news`.
- **Documentation:** `AGENTS.md`, `README.md`, and the project baseline spec mention the implemented articles section.
