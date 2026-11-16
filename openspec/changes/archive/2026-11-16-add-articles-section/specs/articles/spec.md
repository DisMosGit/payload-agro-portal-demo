# Spec Delta

## Purpose

Defines a long-form articles section whose content is authored and published only by authenticated administrators, whose drafts and scheduled items are never exposed to visitors, and whose published pages remain readable and complete when YouTube or another media source is unavailable.

## ADDED Requirements

### Requirement: Article content model

Each article SHALL store a title, a unique slug, an optional summary, an author byline, a publication date, an optional hero image, tags, and an ordered body of content blocks. It SHALL also support an optional video with a poster, duration, external link, and optional alternative source. This requirement is read-only for unauthenticated users; article fields are authored by authenticated administrators and exposed to visitors only through published public reads.

#### Scenario: Complete article is saved

- **WHEN** an authenticated administrator saves an article with a title, summary, byline, publication date, tags, hero image, video metadata, and structured content
- **THEN** the article stores those values and exposes a unique slug generated from its title

#### Scenario: Required fields are enforced on publish

- **WHEN** an authenticated administrator tries to publish an article missing a title, byline, publication date, or content blocks
- **THEN** validation fails and the article is not published

#### Scenario: Optional fields may be omitted

- **WHEN** a published article has no summary, hero image, tags, or video
- **THEN** its public pages render without those elements and without a broken video area

#### Scenario: Slugs are unique within articles

- **WHEN** a second article would receive the same slug as an existing article
- **THEN** the duplicate slug is rejected and the article is not saved under that slug

#### Scenario: An explicit slug is preserved

- **WHEN** an administrator supplies a custom slug and later edits the title
- **THEN** the stored article slug is not silently rewritten

### Requirement: Structured content blocks render safely

The article body SHALL consist of ordered typed blocks for sections, images, galleries, tables, callouts, and footnotes. The system MUST render only supported block types, escape authored text, and MUST NOT interpret stored text or captions as raw HTML. A missing or unresolvable media reference MUST be omitted or shown as unavailable without failing the page. This requirement is read-only for unauthenticated users.

#### Scenario: Section blocks form the article body

- **WHEN** a published article contains section blocks with headings and rich text
- **THEN** the detail page renders each heading and its formatted text in the authored order

#### Scenario: Images and galleries show captions

- **WHEN** an article contains an image block or a gallery block with caption text
- **THEN** the page renders the image or gallery with its visible caption and alternative text

#### Scenario: Tables use structured rows and cells

- **WHEN** an article contains a table block
- **THEN** the page renders the caption, header row, and cell text as table markup rather than as preformatted or raw HTML content

#### Scenario: Callouts and footnotes are distinct

- **WHEN** an article contains a callout block or a footnotes block
- **THEN** the callout is presented as an emphasised note and the footnotes are presented as a numbered list with stable anchors

#### Scenario: Authored markup is not executable

- **WHEN** authored text or a caption contains HTML or script-like characters
- **THEN** the characters are displayed as text and no executable markup or event handler is produced

#### Scenario: Missing media does not break the page

- **WHEN** an image, gallery item, or referenced file is missing or inaccessible
- **THEN** the page still responds successfully and shows only the remaining content plus an unavailable indication where appropriate

#### Scenario: Unknown block types are ignored

- **WHEN** an article contains a block type the frontend does not support
- **THEN** the page skips that block and continues rendering the supported content

### Requirement: Downloadable attachments

Article bodies SHALL support downloadable attachment blocks with a label and a stored file. Public pages SHALL render a direct download link with the file label and a clear unavailable state when the file cannot be resolved. Uploads SHALL be restricted to document file types, readable by the public, and mutable only by authenticated administrators.

#### Scenario: Attachment renders a download link

- **WHEN** a published article contains an attachment block for an available document
- **THEN** the page shows the label and a link that downloads or opens the stored file

#### Scenario: Missing attachment is marked unavailable

- **WHEN** an attachment block references a file that no longer exists
- **THEN** the page shows an unavailable state for that item and the rest of the article still renders

#### Scenario: Unsupported file type is rejected

- **WHEN** an administrator attempts to upload an executable or other non-document file as an article attachment
- **THEN** the upload is rejected

#### Scenario: Anonymous attachment upload is rejected

- **WHEN** an unauthenticated caller submits an attachment upload
- **THEN** the request is rejected and no file is stored

### Requirement: Resilient video preview

Articles with a configured video SHALL show a poster, title, duration, external link, and alternative source when configured in the list and detail page, with a clear unavailable state. The YouTube embed MUST load only after visitor action and MUST fail closed to the fallback. The pages and fallbacks MUST work without JavaScript. This requirement is read-only for unauthenticated users.

#### Scenario: Listing shows a poster preview without loading YouTube

- **WHEN** a visitor requests the article list
- **THEN** each article with a video shows its poster, duration, and a link to the article, and the initial page load makes no YouTube embed request

#### Scenario: Detail page works with JavaScript disabled

- **WHEN** a visitor opens a published article with a video and client-side JavaScript is disabled
- **THEN** the page still shows the poster, duration, external video link, and alternative source link when configured

#### Scenario: Visitor starts the YouTube preview

- **WHEN** a visitor activates the video preview and the YouTube embed is reachable
- **THEN** the embed is loaded in place and remains usable alongside the fallback links

#### Scenario: YouTube is blocked or times out

- **WHEN** the YouTube embed fails to load, is blocked, or does not respond within the timeout
- **THEN** the page shows an informative unavailable state with the poster, duration, external link, and alternative source when configured, and the rest of the article continues to render

#### Scenario: Alternative source is configured

- **WHEN** an article has an alternative direct video source
- **THEN** the page offers a playable alternative or a clear link to it without requiring YouTube

#### Scenario: Video metadata is incomplete

- **WHEN** an article has partial video configuration such as a missing poster or duration
- **THEN** the page shows an explicit video-unavailable state instead of a broken player or an empty frame

#### Scenario: Poster is missing or fails to load

- **WHEN** a video's poster is absent or cannot be fetched
- **THEN** the preview keeps its layout and duration with a text placeholder rather than collapsing or hiding the fallback links

### Requirement: Table of contents and reading metadata

A published article page SHALL generate a table of contents from its section headings in document order, with stable in-page anchors, and SHALL show a reading-time estimate derived from the article text, the author byline, and the publication date. The table of contents MUST be present in the server-rendered HTML and MUST NOT require client-side JavaScript. This requirement is read-only for unauthenticated users.

#### Scenario: Table of contents follows section order

- **WHEN** a published article has multiple section headings
- **THEN** the detail page lists those headings in the same order and each entry links to its section anchor

#### Scenario: Duplicate or special-character headings get distinct anchors

- **WHEN** two sections have the same heading or a heading contains punctuation or non-ASCII characters
- **THEN** each section receives a unique, URL-safe anchor and both table-of-contents links resolve to the intended section

#### Scenario: Reading time reflects article length

- **WHEN** an article contains longer or shorter authored text
- **THEN** the displayed reading time changes accordingly and is never less than one minute

#### Scenario: Article without sections still renders

- **WHEN** a published article has content blocks but no section headings
- **THEN** the article renders without an empty table of contents

#### Scenario: Author and date are visible

- **WHEN** a published article is displayed
- **THEN** its byline and publication date are visible in the server-rendered HTML

### Requirement: Published status gates public reads

Unauthenticated callers SHALL receive only articles whose status is published and whose scheduled publication time has passed. Draft and future-scheduled articles MUST NOT be exposed through the list page, a direct detail URL, related-article sections, or the public API. Authenticated administrators SHALL be able to read drafts and scheduled articles. This requirement is read-only for unauthenticated users.

#### Scenario: Draft is hidden from public reads

- **WHEN** a draft article exists and an unauthenticated caller requests the article list, the article API, or a related-article section
- **THEN** the draft article is not returned

#### Scenario: Draft detail URL returns not found

- **WHEN** a visitor requests the detail page of a draft article or an unknown slug
- **THEN** the response is 404

#### Scenario: Scheduled article stays hidden before its time

- **WHEN** an administrator schedules an article for a future time and a visitor requests the public pages before that time
- **THEN** the article is not listed and its detail URL is not found

#### Scenario: Scheduled article appears after publication

- **WHEN** the scheduled publication time passes and the scheduled publish job runs
- **THEN** the next public request lists the article and serves its detail page

#### Scenario: Published article is readable

- **WHEN** an article has been published and its publication time has passed
- **THEN** unauthenticated callers can read it in the list and by its slug

#### Scenario: Administrator sees drafts and scheduled articles

- **WHEN** an authenticated administrator reads the articles collection
- **THEN** draft, scheduled, and published articles are returned

### Requirement: Article mutations require an authenticated administrator

Creating, updating, deleting, and scheduling articles and their attachments SHALL require an authenticated administrator session. Unauthenticated create, update, delete, upload, and schedule requests MUST be rejected and MUST NOT alter stored data. This requirement is write-restricted: unauthenticated users are read-only.

#### Scenario: Anonymous create is rejected

- **WHEN** an unauthenticated caller submits a create request for an article
- **THEN** the request is rejected with an authorization error and no article is created

#### Scenario: Anonymous update is rejected

- **WHEN** an unauthenticated caller submits an update for an existing article
- **THEN** the request is rejected and the stored article is unchanged

#### Scenario: Anonymous delete is rejected

- **WHEN** an unauthenticated caller submits a delete for an existing article
- **THEN** the request is rejected and the article still exists

#### Scenario: Authenticated administrator can mutate

- **WHEN** an authenticated administrator creates, updates, schedules, or deletes an article or attachment
- **THEN** the operation succeeds and a subsequent read reflects it

### Requirement: Server-rendered public article list

The `/articles` page SHALL be server-rendered for every request and SHALL show only published articles, newest publication date first, with the title, summary, byline or date, tags, reading time, and the video preview when present. It SHALL paginate with page links only and MUST NOT contain forms, comment controls, editing or deleting controls, admin-panel links, or client-side code that writes. This requirement is read-only for unauthenticated users.

#### Scenario: Visitor sees published articles newest first

- **WHEN** an unauthenticated visitor requests the article list
- **THEN** the response contains each published article's title, summary, and metadata in newest-publication-date order

#### Scenario: Draft and scheduled articles are absent from the list

- **WHEN** draft or future-scheduled articles exist
- **THEN** they do not appear in the public list

#### Scenario: Pagination exposes older articles

- **WHEN** more published articles exist than fit on one page
- **THEN** the list shows page links, each valid page shows the correct slice, and an out-of-range page shows an empty state without failing

#### Scenario: Empty list renders

- **WHEN** no article is published
- **THEN** the page responds successfully with an empty-state message

#### Scenario: List contains no write path

- **WHEN** the article list response is inspected
- **THEN** it contains no form, comment control, editing or deleting control, or admin-panel link

#### Scenario: List is server-rendered content

- **WHEN** the article list is requested without executing client-side JavaScript
- **THEN** the response HTML already contains the published article titles and links

### Requirement: Server-rendered public article detail

The `/articles/[slug]` page SHALL be server-rendered for every request and SHALL show the title, byline, publication date, reading time, tags, video, hero image, table of contents, supported content blocks, attachments, and related articles. It MUST NOT contain forms, comment controls, editing or deleting controls, admin-panel links, or client-side write code. This requirement is read-only for unauthenticated users.

#### Scenario: Visitor opens a published article

- **WHEN** an unauthenticated visitor requests the detail page of a published article's slug
- **THEN** the response contains the title, byline, date, reading time, table of contents, and all supported content blocks

#### Scenario: Unknown or draft slug returns not found

- **WHEN** a visitor requests a slug that does not identify a published article
- **THEN** the response is 404

#### Scenario: Related articles share tags and exclude drafts

- **WHEN** a published article has tags that other published articles share
- **THEN** related articles show matching published articles, exclude the current article, and never show drafts or scheduled items

#### Scenario: Related articles have a fallback

- **WHEN** no other published article shares a tag with the current article
- **THEN** the related section shows recent published articles or is omitted without an error

#### Scenario: Detail contains no write path

- **WHEN** the article detail response is inspected
- **THEN** it contains no form, comment control, editing or deleting control, or admin-panel link

### Requirement: Article SEO metadata and canonical URLs

The article detail page SHALL expose a document title, description, canonical URL of `/articles/<slug>`, and Open Graph and Twitter metadata derived from the article. The list page SHALL expose its own page metadata and canonical URL. Metadata generation MUST NOT expose draft or scheduled content. This requirement is read-only for unauthenticated users.

#### Scenario: Metadata describes a published article

- **WHEN** a published article detail page is rendered
- **THEN** its metadata title and description derive from the article and its canonical URL points at the article's `/articles/<slug>` path

#### Scenario: Social image uses the best available image

- **WHEN** a published article has a hero image or video poster
- **THEN** its social metadata uses that image when available

#### Scenario: List metadata describes the section

- **WHEN** the article list page is rendered
- **THEN** its metadata describes the articles section and its canonical URL points at the article list path

#### Scenario: Hidden content has no public metadata

- **WHEN** a visitor requests a draft or scheduled article URL
- **THEN** the response is 404 and no draft article metadata is exposed

### Requirement: Article URLs are isolated from news

Article routes SHALL live under `/articles` and `/articles/[slug]` and MUST NOT share route segments, slug uniqueness, content queries, or listing state with news. Publishing an article MUST NOT create, modify, or display a news item.

#### Scenario: Article and news paths resolve independently

- **WHEN** an article and a news item have the same slug
- **THEN** the article is served at `/articles/<slug>`, the news item is served at `/news/<slug>`, and neither path returns the other item

#### Scenario: News list excludes articles

- **WHEN** an article is published
- **THEN** it does not appear on `/news` or at `/news/<article-slug>` unless a separate news item has that slug

#### Scenario: Article list excludes news

- **WHEN** a news item is published
- **THEN** it does not appear on `/articles` or at `/articles/<news-slug>` unless a separate article has that slug

### Requirement: Publication changes appear on the next request

Publishing, updating, scheduling, unpublishing, or deleting an article in the admin panel SHALL be reflected on the public list, detail, related-article, and pagination views on the next request, without a rebuild, redeploy, or manual cache purge. This requirement is read-only for unauthenticated users.

#### Scenario: Newly published article appears

- **WHEN** an administrator publishes a new article
- **THEN** the next request to the list includes it and its detail page returns 200

#### Scenario: Edited article shows new content

- **WHEN** an administrator saves a change to a published article's title or body
- **THEN** the next request to its detail page shows the updated content

#### Scenario: Unpublished article disappears

- **WHEN** an administrator unpublishes or deletes a published article
- **THEN** the next request to the list omits it and its detail page returns 404
