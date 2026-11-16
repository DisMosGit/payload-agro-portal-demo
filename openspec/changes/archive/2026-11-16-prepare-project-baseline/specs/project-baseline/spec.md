# Spec Delta

## Purpose

Defines the conditions every later change can rely on: a repository that contains only the Payload surface needed to boot and administer it, one coherent dependency set on one package manager, a reproducible local stack with persistent data, and agent instructions that match reality.

## ADDED Requirements

### Requirement: Minimal runtime surface

The project SHALL ship only what Payload needs to start and be administered: an authenticated users collection and an uploads collection. It MUST NOT contain example collections, seed data, demo routes, or demo content.

#### Scenario: Collection surface is minimal

- **WHEN** the Payload configuration is loaded
- **THEN** exactly `users` and `media` are registered, with no example collection and no seeded documents

#### Scenario: Demo route is removed

- **WHEN** a request is made to `/my-route`
- **THEN** the response is a 404 rather than a custom demo payload

#### Scenario: Placeholder is neutral

- **WHEN** `/` is requested
- **THEN** the page renders neutral project copy with no Payload branding, no external documentation link, and no "edit this file" footer

### Requirement: Read-only public frontend

Unauthenticated visitors SHALL have read-only access to the frontend, which MUST NOT render forms, edit or delete controls, or client-side code that writes. All content mutation SHALL require an authenticated admin session, enforced by Payload access control rather than by hiding UI. This is a content requirement: unauthenticated users are read-only.

#### Scenario: Home page serves no write path

- **WHEN** `/` is requested without a session
- **THEN** the response contains no form, write control, or write-capable client code

#### Scenario: Admin panel requires authentication

- **WHEN** `/admin` is requested without a session
- **THEN** the login screen is served and no collection is accessible before signing in

#### Scenario: First administrator can sign in

- **WHEN** a database with no users exists and an administrator is created through the admin panel
- **THEN** that account can sign in and reach the dashboard

### Requirement: Single package manager

The project SHALL declare pnpm as its only package manager and SHALL commit exactly one lockfile. Install, script, documentation, and container commands MUST all use pnpm.

#### Scenario: Frozen install succeeds

- **WHEN** `pnpm install --frozen-lockfile` runs on a clean checkout
- **THEN** it completes without modifying the lockfile

#### Scenario: No competing lockfiles

- **WHEN** the repository root is listed
- **THEN** only `pnpm-lock.yaml` is present, with no `package-lock.json` or `yarn.lock`

### Requirement: Synchronized Payload dependency set

Every Payload package (`payload`, all `@payloadcms/*` packages, and the Postgres adapter) SHALL resolve to one identical version, with one installed copy per package, and SHALL satisfy the peer ranges it declares for Next, React, React DOM, and graphql.

#### Scenario: Versions are identical

- **WHEN** the installed dependency tree is inspected
- **THEN** every Payload package reports the same version

#### Scenario: No duplicate installations

- **WHEN** the dependency tree is inspected
- **THEN** each Payload package appears exactly once, with no nested copy at another version

#### Scenario: Peer ranges are satisfied

- **WHEN** declared peer requirements are compared with the manifest
- **THEN** Next, React, React DOM, and graphql fall inside the ranges Payload declares

### Requirement: PostgreSQL with a readiness gate

Docker Compose SHALL run the Payload application and a PostgreSQL database. The database SHALL expose a healthcheck, and the application SHALL start only after the database reports healthy.

#### Scenario: Database gates application startup

- **WHEN** the stack starts from a cold state
- **THEN** PostgreSQL passes its healthcheck before the application container starts

#### Scenario: Application is reachable

- **WHEN** the stack is running
- **THEN** the application responds on port 3000 and `/admin` serves the login page

#### Scenario: Unhealthy database blocks the application

- **WHEN** PostgreSQL fails its healthcheck
- **THEN** the application service does not start

### Requirement: Persistent data and media

Compose SHALL store database files and uploaded media in named volumes so that a normal stop and start preserves them.

#### Scenario: Restart preserves data

- **WHEN** the stack is stopped without deleting volumes and started again
- **THEN** the administrator account and previously uploaded media are still present

#### Scenario: Recreating the app container preserves uploads

- **WHEN** the application container is recreated
- **THEN** previously uploaded media remains available

### Requirement: Environment template and build hygiene

The repository SHALL provide an `.env.example` that lists every variable the stack requires, with placeholders and no real secrets, and a `.dockerignore` that keeps development artifacts out of image builds. Real secrets MUST remain untracked.

#### Scenario: Example covers the stack

- **WHEN** `.env.example` is read
- **THEN** it lists database credentials, the database URL, and the Payload secret using non-secret placeholders

#### Scenario: Secrets stay untracked

- **WHEN** the working tree is inspected
- **THEN** `.env` is ignored and no secret value appears in a tracked file

#### Scenario: Development artifacts stay out of images

- **WHEN** an image build context is assembled
- **THEN** `node_modules`, `.next`, `.git`, media, test output, and `.env` are excluded

### Requirement: Agent entry point

`AGENTS.md` SHALL describe the project in two or three sentences and give the exact dependency install, dev server, Compose, type-check, and build commands, the rule that content changes happen only through the admin panel, and where Payload configuration and collections live.

#### Scenario: Commands work as written

- **WHEN** a reader follows the commands in `AGENTS.md` from a clean checkout
- **THEN** install, dev server, and Compose start succeed as described

#### Scenario: Stated rules match behavior

- **WHEN** `AGENTS.md` states that content changes happen only in the admin panel
- **THEN** the described behavior matches the read-only frontend and authenticated admin

#### Scenario: Pointer stays accurate

- **WHEN** collections are added in a later change
- **THEN** `AGENTS.md` already points to the configuration and collection directories that will hold them
