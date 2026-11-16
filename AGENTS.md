# Agents

## Project

Payload CMS 3 on the Next.js App Router with PostgreSQL, written in TypeScript. The public frontend is read-only; every content change is made by an authenticated administrator in the Payload admin panel at `/admin`. News is implemented with the `news` collection and the public routes `/news` and `/news/[slug]`. Articles, service points on a map, and equipment listings are not implemented yet.

## Setup

Use Node 22.23.5 (the version in the Compose image) or another version accepted
by `engines` in `package.json`. Node 24.21.x is outside that range and makes
every pnpm command print an "Unsupported engine" warning. pnpm comes from
corepack.

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm exec playwright install chromium
```

Then fill in `PAYLOAD_SECRET` and the Postgres values in `.env`.

## Commands

| Task | Command |
| --- | --- |
| Dev server on http://localhost:3000 | `pnpm dev` |
| App + PostgreSQL with Compose | `docker compose up -d` |
| Stop the stack, keep data | `docker compose down` |
| Type check | `pnpm exec tsc --noEmit` |
| Lint | `pnpm lint` |
| Production build | `pnpm build` |
| Integration tests | `pnpm test:int` |
| End-to-end tests | `pnpm test:e2e` |

Compose installs dependencies inside the `node_modules` volume on first start; database files and uploaded media persist in the `pgdata` and `media` volumes. Run either the Compose app or `pnpm dev` on port 3000, not both.

## Local runbook

- Restart the app after changing `src/payload.config.ts` or a collection config
  (`docker compose restart app`, or restart `pnpm dev`). Next hot reload does not
  re-register collections; Payload then answers
  `The collection with slug <slug> can't be found`.
- With the app running, request `/admin/login` and `/news` once before
  `pnpm test:e2e`. The admin suite's `beforeAll` has a 30-second limit.
- The suites share one development database. Keep Vitest `fileParallelism: false`
  and Playwright `workers: 1`; parallel runs race on Payload's schema push and on
  published rows.
- Run one suite with a positional path, not `--`:
  `pnpm test:e2e tests/e2e/news.e2e.spec.ts`. With
  `pnpm test:e2e -- tests/e2e/news.e2e.spec.ts` the `--` is forwarded and every
  suite runs.

## Content and access

- Content changes only through the Payload admin panel (`/admin`), enforced by collection access control rather than by hiding UI.
- The public frontend is strictly read-only: no forms, no client-side writes, no edit or delete controls.

## Payload notes

- `slugField()` is not self-sufficient in Payload 3.93: the admin slug input
  starts locked, and the helper's hook runs after required-field validation, so a
  create that omits a slug fails. Keep a `beforeValidate` slug guard (see
  `src/collections/News.ts`) or pass an explicit slug.

## Where things live

- Payload config: `src/payload.config.ts`
- Collections: `src/collections/` (currently `Users.ts`, `Media.ts`, and `News.ts`)
- Public news reads: `src/lib/news.ts`
- Frontend routes: `src/app/(frontend)/` (the news section lives in `src/app/(frontend)/news/`)

Agent skills: `.agents/skills/payload/SKILL.md` and `.agents/skills/commit/SKILL.md`.
