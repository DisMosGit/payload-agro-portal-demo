# service-points Specification

## Purpose

Defines a public directory of service points — dealers, service centres, and warehouses — that administrators manage in the Payload admin panel and visitors explore as markers on a read-only, mobile-friendly map page.

## Requirements

### Requirement: Service point content model

Each service point SHALL store a required name, an optional type (dealer, service centre, or warehouse), required latitude and longitude coordinates, an optional address, optional phone, email, and website contact details, and optional notes. This requirement is read-only for unauthenticated users: fields are authored by authenticated administrators and exposed to visitors only through public reads.

#### Scenario: Complete service point is saved

- **WHEN** an authenticated administrator saves a point with a name, type, coordinates, address, and contact details
- **THEN** the point stores those values and is available to public reads

#### Scenario: Required fields are enforced

- **WHEN** an administrator tries to save a point without a name, latitude, or longitude
- **THEN** validation fails and the point is not saved

#### Scenario: Coordinates are range-checked

- **WHEN** an administrator enters a latitude outside −90…90 or a longitude outside −180…180
- **THEN** validation fails and the point is not saved

#### Scenario: Optional details may be omitted

- **WHEN** a point is saved with only a name and coordinates
- **THEN** it is saved and its public marker and popup render without address or contact details

### Requirement: Public reads

Unauthenticated callers SHALL be able to read every saved service point through the collection's list and single-document read paths. This requirement is read-only for unauthenticated users: no anonymous write path exists.

#### Scenario: Anonymous list read returns all points

- **WHEN** an unauthenticated caller lists service points and points exist
- **THEN** every saved point is returned with its coordinates

#### Scenario: Anonymous single read returns a point

- **WHEN** an unauthenticated caller requests a saved point by its identifier
- **THEN** the point is returned

#### Scenario: Empty collection returns an empty result

- **WHEN** no service point exists and an unauthenticated caller lists them
- **THEN** the result is an empty list rather than an error

### Requirement: Mutations require an authenticated administrator

Creating, updating, and deleting service points SHALL require an authenticated administrator session. Unauthenticated create, update, and delete requests MUST be rejected and MUST NOT alter stored data. This requirement is write-restricted: unauthenticated users are read-only.

#### Scenario: Anonymous create is rejected

- **WHEN** an unauthenticated caller submits a create request
- **THEN** the request is rejected with an authorization error and no point is created

#### Scenario: Anonymous update is rejected

- **WHEN** an unauthenticated caller submits an update for an existing point
- **THEN** the request is rejected and the stored point is unchanged

#### Scenario: Anonymous delete is rejected

- **WHEN** an unauthenticated caller submits a delete for an existing point
- **THEN** the request is rejected and the point still exists

#### Scenario: Authenticated administrator can mutate

- **WHEN** an authenticated administrator creates, updates, or deletes a point
- **THEN** the operation succeeds and a subsequent read reflects it

### Requirement: Read-only public map page

The `/service-points` page SHALL display every saved point as an interactive marker on a map rendered with a free and open-source mapping library, and SHALL provide the same point information as server-rendered text. The page MUST NOT contain forms, editing or deleting controls, admin-panel links, or client-side code that writes. This requirement is read-only for unauthenticated users.

#### Scenario: Every point appears as a marker

- **WHEN** an unauthenticated visitor opens the page and points exist
- **THEN** the map displays one marker per point at its stored coordinates

#### Scenario: Page exposes no write path

- **WHEN** the page response is inspected
- **THEN** it contains no form, no editing or deleting control, no admin-panel link, and no client-side write code

#### Scenario: Point information is server-rendered

- **WHEN** the page is requested without executing client-side JavaScript
- **THEN** the response HTML contains each point's name, address, and contact details

### Requirement: Marker popups show read-only details

Clicking a marker SHALL open a read-only popup with the point's name and its address and contact details when present. Absent details MUST be omitted. The popup MUST NOT contain inputs, forms, or save, edit, or delete controls. This requirement is read-only for unauthenticated users.

#### Scenario: Marker popup shows basic information

- **WHEN** a visitor activates a marker
- **THEN** a popup shows the point's name, its address, and each contact detail that is present

#### Scenario: Absent details are omitted

- **WHEN** a point has no address or contact details
- **THEN** its popup shows only the fields that are present without empty placeholders

#### Scenario: Popup is read-only

- **WHEN** a marker popup is open
- **THEN** it contains no input, form, save, edit, or delete control

### Requirement: Empty map page renders an empty state

When no service point exists, the page SHALL respond successfully and show a clear empty-state message. It MUST NOT crash, render a broken map control, or show an error page. This requirement is read-only for unauthenticated users.

#### Scenario: No points renders a message

- **WHEN** an unauthenticated visitor opens the page and no point exists
- **THEN** the response is 200 and the page shows an empty-state message

#### Scenario: Empty page has no map failure

- **WHEN** the page is rendered with zero points
- **THEN** no map initialization error occurs and the rest of the page remains usable

### Requirement: Added points appear after a page reload

A point created, updated, or deleted in the admin panel SHALL be reflected on the public map page on the next page load, without a rebuild or redeploy. This requirement is read-only for unauthenticated users.

#### Scenario: Newly added point appears

- **WHEN** an administrator saves a new point in the admin panel and a visitor reloads the map page
- **THEN** the new marker is present and its popup shows the saved details

#### Scenario: Deleted point disappears

- **WHEN** an administrator deletes a point and a visitor reloads the map page
- **THEN** the point's marker and server-rendered entry are absent

### Requirement: Map is usable on mobile devices

The map page SHALL remain usable at narrow mobile viewports: the map SHALL be visible, markers SHALL be activatable by touch or click, popups SHALL be readable, and the page MUST NOT introduce horizontal overflow. This requirement is read-only for unauthenticated users.

#### Scenario: Narrow viewport renders the map

- **WHEN** the page is opened at a mobile viewport width
- **THEN** the map is visible and the page does not scroll horizontally

#### Scenario: Marker popup works on mobile

- **WHEN** a visitor activates a marker at a mobile viewport width
- **THEN** the popup opens and its text is readable within the viewport
