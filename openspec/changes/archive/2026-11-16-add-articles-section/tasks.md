# Tasks

## 1. Article attachments collection

- [x] 1.1 Implement `src/collections/ArticleAttachments.ts` as a document-only upload collection with a required title, optional description, public read access, authenticated create/update/delete, and a MIME allowlist for PDF, Word, Excel, CSV, and ZIP files; verify `pnpm exec tsc --noEmit` passes and the collection appears in the admin after a dev-server restart.
- [x] 1.2 Add `tests/int/article-attachments-access.int.spec.ts` covering public read of an uploaded document, rejected anonymous create/update/delete and upload, accepted authenticated upload, and rejected disallowed MIME type; verify `pnpm test:int tests/int/article-attachments-access.int.spec.ts` passes.
- [x] 1.3 Document the attachment MIME allowlist and the public-asset behavior in `README.md`; verify the documented formats match `ArticleAttachments.ts`.

## 2. Articles collection, admin, and scheduled publishing

- [x] 2.1 Define the structured blocks in `src/blocks/ArticleBlocks.ts` and the collection in `src/collections/Articles.ts`: title, unique slug guard, summary, byline, publication date, hero, indexed tags, conditional video group, content blocks, and SEO overrides; verify `pnpm exec tsc --noEmit` passes and the admin form exposes the expected fields after a restart.
- [x] 2.2 Add access control to `Articles.ts`: anonymous reads limited to published articles whose `publishedAt` has passed, authenticated reads including drafts, and authenticated-only create/update/delete; enable `versions.drafts.schedulePublish`; verify the access integration tests in 2.5 pass.
- [x] 2.3 Register `ArticleAttachments` and `Articles` in `src/payload.config.ts`, add `jobs.autoRun` with a one-minute default queue, then run `pnpm generate:types` and `pnpm generate:importmap`; verify the generated article types exist and the schedule-publish control is visible in the article admin after a restart.
- [x] 2.4 Add `tests/helpers/seedArticles.ts` with published, draft, future-dated, and scheduled fixtures plus a complete block set (sections, image, gallery, table, callout, footnotes, downloads); verify the helper is used by the access and public-page suites.
- [x] 2.5 Add `tests/int/articles-access.int.spec.ts` covering anonymous published-only reads, hidden drafts and future-dated articles even with `draft: true`, anonymous create/update/delete rejection, and authenticated administrator CRUD; verify `pnpm test:int tests/int/articles-access.int.spec.ts` passes.
- [x] 2.6 Add `tests/e2e/articles-api.e2e.spec.ts` covering public REST reads, anonymous write rejection with 401/403, and authenticated create/delete; verify `pnpm test:e2e tests/e2e/articles-api.e2e.spec.ts` passes after restarting the dev server and prewarming `/admin/login` and `/articles`.
- [x] 2.7 Add `tests/int/articles-schedule.int.spec.ts` that queues a native `schedulePublish` job for a near-future time, runs the jobs queue, and asserts the article changes from hidden to publicly readable; verify `pnpm test:int tests/int/articles-schedule.int.spec.ts` passes and does not depend on the one-minute cron tick.
- [x] 2.8 Add `tests/e2e/articles-admin.e2e.spec.ts` that creates an article in the admin, publishes it, verifies it on the public site, edits it, unpublishes it, and confirms a scheduled article remains absent before its time; verify `pnpm test:e2e tests/e2e/articles-admin.e2e.spec.ts` passes with the Playwright browser installed and the dev server restarted.
- [x] 2.9 Update `AGENTS.md` and `README.md` for the new collections, admin draft/publish/schedule workflow, the jobs-runner requirement, and the article URL namespace; verify every stated path and command matches the implementation.

## 3. Articles public section

- [x] 3.1 Implement `src/lib/articles.ts` with access-controlled list, slug, and related reads (`overrideAccess: false`, no `_status` filter), pagination, tag-related fallback, TOC anchor generation, reading-time calculation, video-state normalization, and date/duration/file-size formatting; verify the helper unit tests in 3.2 pass.
- [x] 3.2 Add `tests/int/articles-content.int.spec.ts` for duplicate/special-character/empty anchors, reading-time bounds, YouTube URL parsing, all video states, and missing attachment/poster fallbacks; verify `pnpm test:int tests/int/articles-content.int.spec.ts` passes.
- [x] 3.3 Build the article components and styles under `src/components/articles/` and `src/app/(frontend)/articles/articles.module.css`: block renderer, TOC, image/gallery/table/callout/footnotes/downloads, related cards, pagination, and the server-side list/detail video previews; ensure text and captions are React-escaped, unknown blocks are skipped, missing media is unavailable rather than fatal, and no raw HTML is rendered.
- [x] 3.4 Build `src/app/(frontend)/articles/page.tsx` with server-rendered cards, poster/duration previews, newest-first ordering, fixed-size pagination, empty and out-of-range states, and no write controls; verify the list assertions in `tests/e2e/articles.e2e.spec.ts` pass.
- [x] 3.5 Build `src/app/(frontend)/articles/[slug]/page.tsx` with server-rendered metadata, canonical/Open Graph/Twitter tags, hero, byline/date/reading time, tags, TOC, structured blocks, downloads, related articles, and a 404 for hidden content; verify the detail assertions in `tests/e2e/articles.e2e.spec.ts` pass.
- [x] 3.6 Implement the client video facade in `src/components/articles/VideoPreview.tsx`: no YouTube request before activation, poster/duration/external/alternative links in the server HTML, iframe load after activation, and a timeout/error state that never hides the fallback; verify the JavaScript-disabled and blocked-YouTube tests in `tests/e2e/articles-video.e2e.spec.ts` pass.
- [x] 3.7 Add `tests/e2e/articles.e2e.spec.ts` covering the list and detail pages with JavaScript disabled, every supported block, TOC links, pagination, related articles, download links, absent drafts, escaped script-like text, a missing media reference, and no forms/comments/admin links; verify `pnpm test:e2e tests/e2e/articles.e2e.spec.ts` passes.
- [x] 3.8 Add `tests/e2e/articles-video.e2e.spec.ts` covering no pre-activation YouTube request, blocked/throttled YouTube fallback, the explicit unavailable state, a working alternative source, and the no-JavaScript fallback; verify `pnpm test:e2e tests/e2e/articles-video.e2e.spec.ts` passes.
- [x] 3.9 Add `NEXT_PUBLIC_SERVER_URL` to `.env.example`, set `metadataBase` in the frontend layout, and use it for article canonical and social URLs; verify the canonical/Open Graph assertions in the article E2E suite pass and the local fallback still builds.
- [x] 3.10 Add the `/articles` link to the home page and update `README.md` and `AGENTS.md` for the public routes, video fallback behavior, and canonical URL setting; verify the home link and documented routes resolve.

## 4. Cross-section integration verification

- [x] 4.1 Add route-isolation coverage that publishes an article and a news item with the same slug, then asserts `/articles/<slug>` and `/news/<slug>` return different content and neither list includes the other collection; verify with `pnpm test:e2e tests/e2e/articles-routes.e2e.spec.ts`.
- [x] 4.2 Run `pnpm test:int` with `fileParallelism: false`; verify all integration suites pass, including the existing news suites.
- [x] 4.3 Run `pnpm test:e2e` with one worker; verify all existing news suites and the new article suites pass after the Playwright browser install, dev-server restart, and `/admin/login`, `/news`, `/articles` prewarm.
- [x] 4.4 Run `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build`; verify all three commands pass with the new collections, generated types, client component, and routes.
- [x] 4.5 Manually create an article with a video and mixed blocks in `/admin`, publish it, and inspect `/articles` and `/articles/<slug>`; then block YouTube in browser devtools and verify the poster, duration, external link, alternative source, and error state keep the page usable.
- [x] 4.6 Run `openspec validate add-articles-section --strict`; verify there are no errors or warnings, including requirement-length and scenario-shape checks.

## Workflow follow-up

- Archive the change only after implementation, review, and validation are complete.
- Confirm before archiving that no public write path was added and no admin-only mutation access was weakened.
