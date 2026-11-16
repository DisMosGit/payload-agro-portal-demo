# Tasks

## 1. Minimal runtime surface

- [x] 1.1 Delete `src/app/my-route/route.ts`; verify `test ! -e src/app/my-route` and `rg -n "my-route" src tests` returns no matches.
- [x] 1.2 Replace `src/app/(frontend)/page.tsx` with a static placeholder (project name, one neutral sentence, a link to `/admin`), drop its stylesheet import and delete `src/app/(frontend)/styles.css`, and set neutral `metadata` in `src/app/(frontend)/layout.tsx`; verify `rg -n "Welcome to your new project|Payload Blank Template|payloadcms\.com/docs|vscode://" src` returns no matches and `node_modules/.bin/tsc --noEmit` passes.
- [x] 1.3 Update `tests/e2e/frontend.e2e.spec.ts` to assert the new title and heading; verify `node_modules/.bin/playwright test --list tests/e2e/frontend.e2e.spec.ts` collects the spec without errors.

## 2. Single package manager

- [x] 2.1 Run `corepack enable`, activate pnpm 10 with `corepack prepare pnpm@10 --activate`, and add `"packageManager": "pnpm@<exact version>"` to `package.json`; verify `pnpm --version` reports the pinned value.
- [x] 2.2 Delete `package-lock.json`, `.npmrc`, and `.yarnrc`, then run `pnpm install`; verify `pnpm-lock.yaml` exists, `pnpm install --frozen-lockfile` succeeds, and `package-lock.json` is gone.
- [x] 2.3 Update the README tech-stack entry to pnpm and add `pnpm-debug.log*` to `.gitignore`; verify `pnpm exec tsc --noEmit` and `pnpm lint` both pass on the fresh install.
- [x] 2.4 Repair `eslint.config.mjs`: import `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` directly instead of wrapping them in `FlatCompat`; verify `pnpm lint` exits 0 with no errors.

## 3. Payload dependency audit

- [x] 3.1 Audit `package.json`, `pnpm-lock.yaml`, and the installed tree for `payload`, every `@payloadcms/*` package, and `@payloadcms/db-postgres`; verify each reports `3.93.0`, appears once, and has no nested copy at another version (`pnpm why payload`, `pnpm list --depth 10`).
- [x] 3.2 Compare `next`, `react`, `react-dom`, and `graphql` with Payload's declared peer ranges; verify each falls inside its range and record the exact versions for the final report. If drift exists, align the Payload packages to one release, reinstall, and repeat this audit — do not upgrade Next or React.

## 4. Compose stack: application and PostgreSQL

- [x] 4.1 Rewrite `docker-compose.yml` as two services: `db` on `postgres:17-alpine` with a `pg_isready` healthcheck and `pgdata:/var/lib/postgresql/data`; `app` on `node:22.23.5-alpine` with the repo bind-mounted, `node_modules` and `media` named volumes, published ports, and `depends_on: db: condition: service_healthy`; verify `docker compose config --services` lists both services and `docker compose config` shows the healthy dependency and named volumes.
- [x] 4.2 Rewrite `.env.example` with placeholder `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, and `PAYLOAD_SECRET`; add matching `POSTGRES_*` values to the local `.env`; add `.dockerignore` excluding build context noise; verify `docker compose config` resolves the app `DATABASE_URL` host to `db`, `git check-ignore -q .env` succeeds, and the real secret does not appear in `.env.example`.
- [x] 4.3 Start the stack with `docker compose up -d --wait` and poll until `/admin` responds (first run installs dependencies); verify `/admin` serves the login page, `/` serves the placeholder copy, `/my-route` returns 404, and `docker compose ps` reports `db` healthy.
- [x] 4.4 Create the first administrator through `POST /api/users/first-register` (the endpoint behind `/admin/create-first-user`), then authenticate with `POST /api/users/login`; verify the login response returns a token and `GET /api/users/me` with it returns that admin. If first-register is unavailable, create the admin at `/admin/create-first-user` and sign in.
- [x] 4.5 Upload a small file to `/api/media` with the admin token; verify `GET /api/media` lists the document and `/api/media/file/<filename>` serves the file.
- [x] 4.6 Stop with `docker compose down`, start again with `docker compose up -d --wait`, and verify the admin account and the media document/file are still present; verify `docker volume ls` lists the project's `pgdata`, `media`, and `node_modules` volumes.
- [x] 4.7 Update the README's Docker Compose and persistence bullets to match the two-service stack; verify every claim in those bullets was demonstrated by steps 4.3–4.6.
- [x] 4.8 Keep container writes out of the host's ownership: mount `next_cache` at `/app/.next`, create `.next` and `media` through the `postinstall` hook, and run the dev server as the unprivileged `node` user after a one-time chown of the volumes; verify `docker compose config` shows the mount, `next-env.d.ts` and `.next` stay owned by the host user after the stack starts, and a host `pnpm build` succeeds while the stack runs.

## 5. Agent entry point

- [x] 5.1 Rewrite `AGENTS.md` with the project description, install/dev/Compose commands, type-check and build commands, the admin-only-write/read-only-frontend rule, the `src/payload.config.ts` and `src/collections/` pointer, and one line pointing at `.agents/skills/`; verify it stays under one page and every command it lists exists in `package.json` or `docker compose config --services`.

## 6. Integration check

- [x] 6.1 Run the full ladder from a clean state: `pnpm install --frozen-lockfile`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`, `docker compose up -d --wait`, admin login, media fetch, then `docker compose down` and `docker compose up -d --wait` with the same checks; verify each passes and report anything that could not be run.

## Workflow follow-up

- Archive the change once review is complete.
- Leave the template Dockerfile unmodified; its standalone-output and missing-`public/` defects are recorded as a follow-up in `design.md`.
