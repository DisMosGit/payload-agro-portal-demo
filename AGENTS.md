# Agents

## Project

Payload CMS 3 on the Next.js App Router with PostgreSQL, written in TypeScript. The public frontend is read-only; every content change is made by an authenticated administrator in the Payload admin panel at `/admin`. The four public sections (news, articles, service points on a map, equipment listings) are not implemented yet.

## Setup

Node 22.23.5 or newer, with pnpm provided by corepack.

```bash
corepack enable
pnpm install
cp .env.example .env
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

## Content and access

- Content changes only through the Payload admin panel (`/admin`), enforced by collection access control rather than by hiding UI.
- The public frontend is strictly read-only: no forms, no client-side writes, no edit or delete controls.

## Where things live

- Payload config: `src/payload.config.ts`
- Collections: `src/collections/` (currently `Users.ts` and `Media.ts`)
- Frontend routes: `src/app/(frontend)/`

Agent skills: `.agents/skills/payload/SKILL.md` and `.agents/skills/commit/SKILL.md`.
