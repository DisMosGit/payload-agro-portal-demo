# Proposal

## Why

The project is a freshly initialized `create-payload-app` template that has been pointed at PostgreSQL but is otherwise still template code: a branding-heavy demo home page, a demo `/my-route`, a Compose file that starts MongoDB while the Payload config uses Postgres, an `.env.example` that lists a Mongo URL, and docs, scripts, and lockfile that disagree about the package manager. A team cannot tell which parts are intentional and cannot start the project reproducibly.

## What Changes

- **Remove template demo surface.** Delete the demo route `src/app/my-route/route.ts`; reduce the home page to a neutral placeholder with no Payload branding, no external docs links, and no "edit this file" copy; drop the demo stylesheet; update the frontend e2e assertion to match the placeholder.
- **Standardize on pnpm.** Declare `packageManager` and `engines`, generate and commit `pnpm-lock.yaml`, remove `package-lock.json`, and keep scripts, Compose, and docs on pnpm only. Remove npm/yarn-only config left by the template.
- **Verify Payload package versions.** Confirm `payload`, every `@payloadcms/*` package, and the Postgres adapter are on one exact version with one installed copy each, and that Next/React/graphql peer ranges are satisfied. Align only if drift is found; document the versions checked.
- **Replace the data service in Compose.** Swap MongoDB for PostgreSQL with a `pg_isready` healthcheck, make the app service wait for `service_healthy`, and add named volumes for database data and uploaded media. Provide `.env.example` with every required variable and a `.dockerignore` that keeps dev artifacts out of builds. Review the template `Dockerfile` and change it only if the Compose setup needs it.
- **Rewrite `AGENTS.md`** to the requested one-page form: project description, dependency install, dev server and Compose commands, type-check/build commands, the admin-only-write/read-only-frontend rule, and where Payload config and collections live.
- **BREAKING**: local startup now requires pnpm, and `docker compose up` starts PostgreSQL instead of MongoDB; `.env.example` keys change.

The change touches none of the four public sections (news, articles, service points, equipment listings). It only neutralizes the placeholder frontend, so no public read or write path is added or altered: the placeholder stays GET-only and all content mutation remains admin-authenticated.

## Capabilities

### New Capabilities

- `project-baseline`: the repository contains only the Payload surface needed to boot and administer it, one coherent dependency set on one package manager, a reproducible local stack with persistent data, and an agent entry point that matches reality.

### Modified Capabilities

None.

## Impact

- **Removed**: `src/app/my-route/route.ts`, the demo home page content, the demo stylesheet, `package-lock.json`, npm/yarn-only config files.
- **Rewritten**: `docker-compose.yml`, `.env.example`, `AGENTS.md`; frontend layout metadata and home page; `tests/e2e/frontend.e2e.spec.ts`; `package.json` metadata and scripts where they disagree with pnpm; `eslint.config.mjs` (native flat config for `eslint-config-next` 16, which otherwise crashes `pnpm lint`).
- **Added**: `pnpm-lock.yaml`, `.dockerignore`, `packageManager`.
- **Reviewed, probably unchanged**: `Dockerfile`, `src/payload.config.ts`, `src/collections/{Users,Media}.ts`, `next.config.ts`.
- **Dependencies**: pnpm installed via corepack; no Payload, Next, or React version changes expected.
- **Out of scope**: building or validating a production Docker image, PostGIS and map work, the four real content collections and their public pages, CI pipelines, and committing anything to git.
