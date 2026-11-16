# Demo Site (Payload CMS)

A demonstration content site built on **Payload CMS 3** with a read-only public frontend and a fully admin-driven editing workflow. The site showcases four public sections — news, articles, service points on a map, and equipment sale listings — while all content changes are made exclusively through the Payload admin panel.

This project serves as a proof of concept for a content-first architecture where the public site is strictly read-only, and all data mutations are gated behind authentication and authorization.

## Features

- **News** — a collection of published news items with images, dates, and rich text.
- **Articles** — longer-form content with a separate model and layout.
- **Service Points** — a collection of dealer/service locations rendered as markers on a map page.
- **Equipment Listings** — sale announcements for used machinery, including photos, price, and condition.
- **Read-only public frontend** — no forms, no edit buttons, no direct API writes from the client.
- **Admin-only editing** — all create, update, and delete operations require an authenticated administrator.
- **Docker Compose** — a two-service stack (Payload app and PostgreSQL) where the database healthcheck gates application startup.
- **Persistent data** — database files and uploaded media live in named volumes and survive container restarts.

## Tech Stack

| Layer | Technology |
|---|---|
| CMS / Backend | Payload CMS 3 (TypeScript) |
| Frontend | Next.js (App Router), server-side rendering |
| Database | PostgreSQL |
| Map Integration | ? API |
| Containerization | Docker Compose |
| Package Manager | pnpm |

## Admin Panel and Content Management

All content is managed through the Payload admin panel at `/admin`.

After logging in, you can:
- Create and publish **news** items.
- Write and publish **articles**.
- Add **service points** with coordinates; they appear on the map immediately after page reload.
- Post **equipment listings** with photos and details.

The public frontend reflects changes on the next request; no build step is required for content updates.

## Read-Only Frontend

The public-facing pages are strictly read-only:
- No forms that mutate data.
- No edit or delete buttons.
- No links that perform write operations.
- API endpoints reject unauthenticated `POST`, `PATCH`, and `DELETE` requests.

This is enforced at the Payload access-control layer and verified during development.

## License

This project is for demonstration purposes. Refer to the repository’s license file for terms of use.
