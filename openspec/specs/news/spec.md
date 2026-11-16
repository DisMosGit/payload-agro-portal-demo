# news Specification

## Purpose

Defines a news section whose items are authored and published only by authenticated administrators, whose drafts are never exposed to visitors, and whose published items are readable as server-rendered, crawlable pages.

## Requirements

### Requirement: News item content model
The system SHALL store each news item with a title, a unique URL slug derived from the title, a full body, a publication date used for ordering, an optional short description for listings, and an optional image from the media collection. This requirement is read-only for unauthenticated users: item fields are stored on behalf of authenticated administrators and are exposed to visitors only through published public reads.

#### Scenario: Complete news item is saved
- **WHEN** an authenticated administrator saves a news item with a title, body, publication date, listing description, and image
- **THEN** the item stores those values and exposes a unique slug generated from its title

#### Scenario: Required fields are enforced on publish
- **WHEN** an authenticated administrator tries to publish an item missing a title, body, or publication date
- **THEN** validation fails and the item is not published

#### Scenario: Optional fields may be omitted
- **WHEN** an item is published without a listing description or an image
- **THEN** it is published and its public pages render without those elements

#### Scenario: Slugs are unique
- **WHEN** a second item would receive the same slug as an existing item
- **THEN** the duplicate slug is rejected and the item is not saved under that slug

### Requirement: Published status gates public reads
Unauthenticated callers SHALL receive only news items whose publication status is `published`. Draft items MUST NOT be exposed through any public read path, including the list page, a direct detail URL, and the public API. This requirement is read-only for unauthenticated users.

#### Scenario: Draft is hidden from public reads
- **WHEN** a draft item exists and an unauthenticated caller requests the news list page or the public news API
- **THEN** the draft item is not returned

#### Scenario: Draft detail URL returns not found
- **WHEN** an unauthenticated visitor requests the detail page of a draft item or an unknown slug
- **THEN** the response is 404

#### Scenario: Published item is readable
- **WHEN** an item has been published
- **THEN** unauthenticated callers can read it in the list and by its slug

#### Scenario: Administrator sees drafts
- **WHEN** an authenticated administrator reads the news collection
- **THEN** both draft and published items are returned

### Requirement: Mutations require an authenticated administrator
Creating, updating, and deleting news items SHALL require an authenticated administrator session. Unauthenticated create, update, and delete requests MUST be rejected and MUST NOT alter stored data. This requirement is write-restricted: unauthenticated users are read-only.

#### Scenario: Anonymous create is rejected
- **WHEN** an unauthenticated caller submits a create request to the news API
- **THEN** the request is rejected with an authorization error and no item is created

#### Scenario: Anonymous update is rejected
- **WHEN** an unauthenticated caller submits an update for an existing item
- **THEN** the request is rejected and the stored item is unchanged

#### Scenario: Anonymous delete is rejected
- **WHEN** an unauthenticated caller submits a delete for an existing item
- **THEN** the request is rejected and the item still exists

#### Scenario: Authenticated administrator can mutate
- **WHEN** an authenticated administrator creates, updates, or deletes an item
- **THEN** the operation succeeds and a subsequent read reflects it

### Requirement: Server-rendered public news list
The news list page SHALL be rendered on the server for every request and SHALL show only published items, newest publication date first, with the title, publication date, listing description or a short body-derived fallback, and the image when present. The page MUST NOT contain forms, editing or deleting controls, links to the admin panel, or client-side code that writes. This requirement is read-only for unauthenticated users.

#### Scenario: Visitor sees published items
- **WHEN** an unauthenticated visitor requests the news list page
- **THEN** the response contains each published item's title, date, and listing text, ordered newest first

#### Scenario: Empty list renders
- **WHEN** no news item is published and a visitor requests the news list page
- **THEN** the page responds successfully with an empty-state message

#### Scenario: List contains no write path
- **WHEN** the news list page response is inspected
- **THEN** it contains no form, no editing or deleting control, and no admin-panel link

#### Scenario: List is server-rendered content
- **WHEN** the news list page is requested without executing client-side JavaScript
- **THEN** the response HTML already contains the published item titles and links

### Requirement: Server-rendered public news detail page
The detail page for a news slug SHALL be rendered on the server for every request and SHALL show the item's title, publication date, image when present, and full body. It SHALL include page metadata derived from the item for search engines and social sharing, and it MUST NOT contain forms, editing or deleting controls, admin-panel links, or client-side write code. This requirement is read-only for unauthenticated users.

#### Scenario: Visitor opens a published item
- **WHEN** an unauthenticated visitor requests the detail page of a published item's slug
- **THEN** the response contains the title, the publication date, and the full body, and the document title reflects the item title

#### Scenario: Unknown slug returns not found
- **WHEN** an unauthenticated visitor requests a slug that does not identify a published item
- **THEN** the response is 404

#### Scenario: Metadata describes the item
- **WHEN** the detail page is rendered
- **THEN** its metadata title and description are derived from the item's title and listing description or body

#### Scenario: Detail contains no write path
- **WHEN** the detail page response is inspected
- **THEN** it contains no form, no editing or deleting control, and no admin-panel link

### Requirement: Publication changes appear on the next request
Publishing, updating, or unpublishing a news item in the admin panel SHALL be reflected on the public list and detail pages on the next request, without a rebuild, redeploy, or manual cache purge. This requirement is read-only for unauthenticated users.

#### Scenario: Newly published item appears
- **WHEN** an administrator publishes a new item in the admin panel
- **THEN** the next request to the list page includes it and its detail page returns 200

#### Scenario: Edited item shows new content
- **WHEN** an administrator saves a change to a published item's title or body
- **THEN** the next request to its detail page shows the updated content

#### Scenario: Unpublished item disappears
- **WHEN** an administrator unpublishes or deletes a published item
- **THEN** the next request to the list page omits it and its detail page returns 404
