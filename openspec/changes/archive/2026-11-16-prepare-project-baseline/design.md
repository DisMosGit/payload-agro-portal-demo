# Design

## Context

See `proposal.md` — Why. Current state that shapes the approach:

- `src/payload.config.ts` already uses `postgresAdapter` and registers only `Users` and `Media`; the demo surface is elsewhere: `src/app/my-route/route.ts`, a branding-heavy home page, its demo stylesheet, and a frontend e2e test that asserts the template copy.
- `docker-compose.yml` still defines MongoDB, has no healthcheck, mounts the repo into a Node image, and runs `corepack prepare pnpm@latest && pnpm install && pnpm dev`; `.env.example` advertises a Mongo URL while `.env` points at PostgreSQL on `127.0.0.1:5432`.
- Only `package-lock.json` exists and `node_modules` was installed with npm (`.npmrc` sets `legacy-peer-deps=true`), yet `engines`, the `test` script, Playwright's `webServer`, README, Dockerfile, Compose, and the repo's commit skill all assume pnpm.
- Installed Payload packages are all `3.93.0` with no nested duplicates. Declared peers are satisfied: `next` 16.4.1 (Payload accepts `>=16.3.3 <17`), `react`/`react-dom` 19.2.9 (UI peer `^19.2.1`), `graphql` 16.15.0 (`^16.8.1`).
- Node 24.21 on the host, `corepack` 0.36 available, Docker 29 with Compose v5 running, and the npm registry reachable. No Postgres is listening on the host, no Playwright browsers are installed, and the repo has no commits yet.

## Goals / Non-Goals

**Goals:**

- A repository a new team member can trust: no demo surface, one package manager, one lockfile, one database engine.
- One command to bring up app + database with a real readiness gate and data that survives restarts.
- Verification grounded in commands and HTTP checks that run in this environment.

**Non-Goals:**

- Implementing the four public sections, their collections, or any map work.
- Adding PostGIS; geospatial work comes with the service-points collection.
- Validating the production Docker image (see Decisions, D6).
- CI, git history, or deployment configuration.

## Decisions

### D1 — Standardize on pnpm

Adopt pnpm as the only package manager: install it through corepack, add a pinned `packageManager`, generate and commit `pnpm-lock.yaml`, delete `package-lock.json`, and remove the npm/yarn-only `.npmrc` and `.yarnrc`.

Rationale: the repo already declares pnpm in `engines`, uses it in `test`/`test:e2e`, Playwright's `webServer`, Dockerfile, Compose, README, and the commit skill. The npm lockfile and `legacy-peer-deps` are artifacts of how the template happened to be installed, not a declaration of intent. pnpm also gives a stricter dependency tree, which is exactly what Step 2 needs to detect drift.

Alternatives: keep npm and rewrite the scripts, engines, Playwright config, README, and skills — more edits, and it fights every existing reference. Yarn — not declared anywhere and adds a third manager to an already confused repo.

Risk: pnpm's stricter peer resolution can surface warnings the npm install hid. Payload's peer ranges are all satisfied above, so expect no failures; if one appears, resolve it by aligning a manifest entry, never by disabling peer checks.

### D2 — Reduce the frontend to a static placeholder

Delete `src/app/my-route/route.ts`; replace the home page with a static server component (project name, one neutral sentence, a link to `/admin`), delete the demo stylesheet and its import, and neutralize the layout metadata. No Payload instance is booted to render `/`. Update `tests/e2e/frontend.e2e.spec.ts` to assert the new title and heading.

Rationale: the template page exists to advertise Payload; it is not a product surface. Keeping it static also keeps the public page independent of the database until real sections exist. The only link is to the admin panel, which is functional, not promotional.

Alternatives: keep a Payload-backed welcome page — rejected as demo content; delete the frontend route group entirely — rejected because the placeholder is the read-only frontend the README describes, and the e2e suite expects a home page.

`Users` and `Media` stay untouched: they are the minimal collections, and both already match the model (auth users, public-read uploads).

### D3 — Verify Payload versions, do not bump

Check the manifest, the lockfile, and the installed tree for `payload`, every `@payloadcms/*` package, and `@payloadcms/db-postgres`; confirm one exact version per package and no nested duplicate. Compare `next`, `react`, `react-dom`, and `graphql` against declared peers. Expected result: no action, all `3.93.0`. If drift appears, align the Payload packages to a single release and regenerate the lockfile; never upgrade Next or React for this change.

### D4 — Compose runs the dev server against PostgreSQL

Two services:

- `db`: `postgres:17-alpine`, credentials from `POSTGRES_*`, a `pg_isready` healthcheck, and `pgdata:/var/lib/postgresql/data`.
- `app`: `node:22.23.5-alpine` (the floor in `engines` and the image the Dockerfile already uses), bind-mounts the repo at `/app`, keeps `node_modules` in a named volume, mounts `media:/app/media`, publishes `${APP_PORT:-3000}`, runs `corepack enable && pnpm install --frozen-lockfile && pnpm dev`, and depends on `db` with `condition: service_healthy`.

Rationale: the team needs hot reload, and the template Compose already took this shape, so the change is a database swap plus a health gate rather than a new runtime model. Named volumes satisfy persistence without making the host tree the source of truth for modules or uploads.

Alternatives: build the production image and run `node server.js` — rejected for this change. It requires `output: 'standalone'` in `next.config.ts`, a `public/` directory that does not exist, and a slow build whose result would still need separate verification; the dev-server path gives the team working hot reload immediately.

Details that matter:

- Compose overrides `DATABASE_URL` for the app to `postgres://…@db:5432/…`, built from `POSTGRES_*`, while `.env` keeps `127.0.0.1` so a host-run `pnpm dev` and `pnpm test:int` still work against the same published database port.
- The healthcheck must use `$${POSTGRES_USER}` / `$${POSTGRES_DB}` so Compose does not interpolate them on the host.
- `pnpm install --frozen-lockfile` runs on every start; it is a no-op when the volume already matches and a hard failure when the lockfile does not, which is the desired signal.
- Postgres is published on `${POSTGRES_PORT:-5432}` so host tooling can use it; use the compose app **or** host `pnpm dev`, not both on port 3000.
- `.next` is a named volume (`next_cache`) so the container's build cache never collides with a host `pnpm build`/`pnpm dev` writing the same directory.
- The container starts as root only long enough to chown `node_modules`, `.next`, and `media`, then drops to the image's unprivileged `node` user through `su`. Writes that reach the bind mount (`next-env.d.ts`, for example) therefore stay owned by the developer, and a host `pnpm build` does not hit permission errors from the container.
- A `postinstall` hook creates `.next` and `media` on the host after `pnpm install`, so Docker reuses those user-owned directories as mountpoints instead of creating root-owned ones. Host `pnpm dev`, `pnpm build`, and host-run media uploads then stay writable even after Compose has run.

### D5 — Environment and build hygiene

`.env.example` documents `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL` (host `127.0.0.1` for local runs), and `PAYLOAD_SECRET`, all as placeholders with a comment that Compose rewrites the host to `db`. `.env` stays gitignored and is verified with `git check-ignore`. `.dockerignore` excludes `node_modules`, `.next`, `.git`, `.env*`, `media`, test/report output, and editor/agent caches. `.gitignore` gains `pnpm-debug.log*`; `.env` and `/media` are already ignored.

### D6 — Review the Dockerfile, leave it unchanged

The template `Dockerfile` targets a standalone production build, but `next.config.ts` does not set `output: 'standalone'` and the image step copies `/app/public`, which does not exist, so it cannot build as-is. Compose uses the Node image directly, so nothing in this change needs it; adjusting it would ship an unverified build path. Record both defects and leave the file for a deployment-focused change.

### D7 — AGENTS.md

Cover exactly the requested points: two or three sentences on what the project is, `pnpm install`, `pnpm dev`, `docker compose up`, `pnpm exec tsc --noEmit` and `pnpm build`, the admin-only-write/read-only-frontend rule, and the location of `src/payload.config.ts` and `src/collections/`. Keep a single closing line pointing at `.agents/skills/payload/SKILL.md` and `.agents/skills/commit/SKILL.md`, because those skills currently rely on `AGENTS.md` pointing to them. Keep it under one page and snippet-free apart from the commands.

### D8 — Verification strategy

1. `pnpm install --frozen-lockfile`, then `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`.
2. `pnpm install`/`pnpm why` audit for the Payload set and peers.
3. `docker compose up -d`, wait for `db` healthy, fetch `/admin` (expect login markup) and `/` (expect placeholder copy).
4. Create the first administrator through `POST /api/users/first-register` — the endpoint the `/admin/create-first-user` view calls — then `POST /api/users/login` to prove the credentials work.
5. Upload a small media file with the admin cookie, confirm `GET /api/media` returns it and `/api/media/file/<filename>` serves it.
6. `docker compose down` (no `-v`), `docker compose up -d`, and re-check the admin login, the media document, and the file. Then `docker compose down` and confirm the `pgdata`/`media` volumes remain.

Playwright is optional here: browsers are not installed, and the API checks above prove the same behavior; if time allows, install Chromium and run `pnpm test:e2e` with the Compose app reused on port 3000.

### D9 — Repair the ESLint config for `eslint-config-next` 16

Rewrite `eslint.config.mjs` to spread `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` directly as flat config arrays instead of passing them through `FlatCompat`.

Rationale: this surfaced during verification. `eslint-config-next` 16.4.1 exports both entries as native flat-config arrays, while the template config feeds them to `FlatCompat`, which expects eslintrc-style objects; ESLint then fails validation and crashes with `TypeError: Converting circular structure to JSON`. The fix is config-only, changes no dependency, and is required for `pnpm lint` to be a meaningful gate in D8. Lint also flagged the placeholder's plain `<a href="/admin">`; it now uses `next/link`.

## Risks / Trade-offs

- [pnpm is not on the host yet] → `corepack enable` writes into the writable Node bin directory; pin the version and fail loudly if corepack cannot download it.
- [Container pulls need network] → `node:22.23.5-alpine` and `postgres:17-alpine` are not cached; if a pull fails, report the stack as untested rather than claiming success.
- [`pnpm install` inside the volume can drift from the lockfile] → `--frozen-lockfile` turns drift into a startup error, and the volume is disposable.
- [Published Postgres port collides with a future local server] → documented; change `POSTGRES_PORT`.
- [Media uploads live in a volume, so they are invisible on the host] → intentional; the Dockerfile/Compose mount is the only writer, and `media/` is gitignored.
- [Postgres 18 is cached locally but its image uses a different data directory] → pin 17 for the conventional `/var/lib/postgresql/data` mount and accept the pull.
- [Removing `legacy-peer-deps` changes resolution] → peers were checked against declared ranges; treat any new warning as a real signal.

## Migration Plan

Order: purify the surface and fix the frontend test → switch to pnpm and regenerate the lockfile → verify versions → rewrite Compose, `.env.example`, `.dockerignore` → rewrite `AGENTS.md` and the affected README lines → run the verification ladder.

Rollback is file-level: restore the previous Compose/`.env.example`/frontend files from the template or this change's record, and `npm install` regenerates `package-lock.json` if the team reverts the manager decision. There is no deployed environment and no database migration in this change; the Compose database is created empty.

## Open Questions

- **Map provider** — still undecided (README shows `? API`). No map, tile, or geocoding choice may be assumed by this change or by the service-points work that follows.
- **pnpm minor** — pin whatever 10.x corepack resolves during apply; any 10.x satisfies `engines`. Record the exact value in `packageManager` so the container uses the same one.
- **Production Docker path** — whether to revive the template Dockerfile later (standalone output, `public/` handling, image verification) is deferred to a deployment-focused change.
