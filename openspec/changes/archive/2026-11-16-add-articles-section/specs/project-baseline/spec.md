# Spec Delta

## MODIFIED Requirements

### Requirement: Minimal runtime surface

The project SHALL ship only collections that belong to the product: the authenticated users collection, the uploads collection, and content collections that correspond to declared public sections. It MUST NOT contain example collections, seed data, demo routes, or demo content.

#### Scenario: Collection surface is minimal

- **WHEN** the Payload configuration is loaded
- **THEN** `users`, `media`, `news`, `articles`, and `article-attachments` are registered, with no example collection and no seeded documents

#### Scenario: Demo route is removed

- **WHEN** a request is made to `/my-route`
- **THEN** the response is a 404 rather than a custom demo payload

#### Scenario: Placeholder is neutral

- **WHEN** `/` is requested
- **THEN** the page renders neutral project copy with no Payload branding, no external documentation link, and no "edit this file" footer
