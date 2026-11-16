---
name: commit
description: "Review all uncommitted changes and split them into separate logically grouped conventional commits (type(scope): summary), ordered from foundational to dependent, staging files or hunks explicitly. Use when the user asks to commit, to split uncommitted work into commits, or to write commit messages."
allowed-tools: Bash(git:*), Bash(pnpm:*), Bash(openspec:*)
license: MIT
metadata:
  author: DisMosGit
  version: "1.1"
  adaptedFor: payload-agro-portal-demo
---

Turn the current uncommitted work into a sequence of self-contained conventional commits, ordered so every commit builds on the one before it.

This is the fleetops `commit` skill adapted to this repo: Payload CMS 3 + Next.js, PostgreSQL, pnpm, Vitest/Playwright, OpenSpec. `README.md` is the source of truth for intent — four public sections (news, articles, service points, equipment listings), a strictly read-only public frontend, and all content mutations behind authenticated Payload admin access.

**Input**: Optionally a subset of paths, a requested grouping, or a scope. Without one, the scope is everything uncommitted — staged, unstaged, and untracked.

**Steps**

1. **Survey the worktree**

   Run and read all of:
   - `git status --short --untracked-files=all` — staged, unstaged, untracked
   - `git diff --stat` and `git diff` — unstaged content
   - `git diff --cached --stat` and `git diff --cached` — already-staged content
   - `git log --oneline -15` — the message style this repo actually uses. A fresh `main` has no commits: say so, and fall back to the Conventional Commits rules in step 4.
   - `git branch -r` — whether remotes exist, and therefore whether a commit may already be pushed.

   Read enough of every changed file to know *what it does*, not just which directory it sits in. Never group by filename alone: a single file often carries two concerns, and two files often carry one. Re-read `README.md` whenever the change touches public pages, access control, or the database setup; the code and README must not end up describing different behaviour.

2. **Group into concerns**

   Each group is one concern that stands alone and reads coherently on its own. Name every group by the message you intend to write for it before touching the index.

   - A collection's config (`src/collections/<Name>.ts`), its registration in `src/payload.config.ts`, the matching hunks in `src/payload-types.ts`, and its tests (`tests/int`, `tests/e2e`) are one concern. A new collection is one commit; two unrelated collections are two.
   - Access-control changes ride with what they guard: collection access, auth rules, and the tests proving the rejection. This is the enforcement layer for the README's read-only frontend — never split enforcement from the behaviour it protects.
   - `src/payload-types.ts` and `src/app/(payload)/admin/importMap.js` are generated and shared. They ride with the source that produces them, but stage only the hunks belonging to that group (`git add -p`, or a filtered patch via `git apply --cached`). Never hand-edit them to make a split easier.
   - Config settings ride with the feature that consumes them: collection registration in `payload.config.ts`, Next settings in `next.config.ts`, a new env var with its consumer plus `.env.example`. Tooling config (ESLint, Prettier, tsconfig) is `chore(repo)` unless it exists only for the feature.
   - A dependency change is one commit: `package.json` plus `package-lock.json` (and `pnpm-lock.yaml` if one appears). A Payload bump may require regenerating `payload-types.ts` and `importMap.js`; keep that output with the bump unless it is genuinely unrelated.
   - Tests ride with the code they test: `tests/int` with the API/access change, `tests/e2e` with the UI flow. A separate `test(...)` commit is for standalone test infrastructure only (`tests/helpers`, Vitest/Playwright config, seed data).
   - Docs describing changed behaviour ride with the change; substantial prose becomes its own `docs(...)` commit. README edits are `docs(repo)` unless they document one feature.
   - Docker: `Dockerfile` and `docker-compose.yml` changes are `build(docker)` or `fix(docker)`; keep them together when they configure one environment.
   - OpenSpec artifacts follow repo precedent: the change plan first (`docs(openspec): add the <change> change plan`), task tick-offs last (`docs(openspec): mark <change> tasks complete`). Run `openspec validate <change>` before committing them.
   - `AGENTS.md` and `.agents/skills/**` are `agents` scope.
   - Formatting-only churn in files unrelated to a change is never mixed into it — leave it out, or ask (step 8).

3. **Order foundational to dependent**

   Dependencies point forward: no commit may need content that only lands in a later one. The repo's ladder:

   openspec plan → deps → config → collections + access control + generated types → API/admin routes (`src/app/(payload)`, `src/app/my-route`) → public frontend (`src/app/(frontend)`) → standalone tests → Docker → docs/agents → OpenSpec task tick-offs.

   Not every change uses every rung; preserve the relative order of the rungs it does use. If a frontend commit needs a collection introduced in the same work, the collection commit comes first.

4. **Write the messages**

   `type(scope): summary`, e.g. `feat(service-points): render dealer locations on the map page`.

   - **Types**: `feat`, `fix`, `docs`, `test`, `chore`, `build`, `refactor`, `perf`, `ci`. If the repo has no history to imitate, these are the baseline and the first commits set the precedent; otherwise follow `git log` while keeping Conventional Commits.
   - **Scopes**: `news`, `articles`, `service-points`, `equipment` (the public sections in README), `media`, `users` (existing collections), `collections` (cross-collection plumbing), `access`, `frontend`, `admin`, `api`, `config`, `tests`, `e2e`, `docker`, `deps`, `agents`, `openspec`, `repo`. Fall back to the directory or module name; do not invent a new scope without a reason. Use kebab-case.
   - Imperative mood, lowercase, no trailing period, subject at most 72 characters.
   - **The message is exactly one line.** No body, no description, no trailer — the subject is the whole message. The subject therefore has to carry the change and its justification on its own: write what changed and why it is not obvious into that line rather than below it, and never pass a second `-m`.
   - No `Co-Authored-By` or "Generated with" trailers. The configured git identity (`git config user.name` / `user.email`; currently `DisMosGit <DisSurgu@ya.ru>`) is the author; nothing else belongs in the message.
   - Do not claim a README capability the code does not implement (for example a `service-points` collection that does not exist yet). Describe what the commit actually adds.

5. **Stage explicitly**

   Stage one group at a time with explicit paths: `git add -- <path>…`.

   When one file's hunks belong to different groups, split them: `git add -p` when the session is interactive, otherwise build a filtered patch and `git apply --cached <patch>`. Confirm what is actually staged with `git diff --cached --stat` and `git status --short --untracked-files=all` before committing.

   Generated files: run `pnpm generate:types` after collection/field changes and `pnpm generate:importmap` after admin-component changes *before* staging, then stage only the relevant hunks. Never stage a hand-edited generated file.

   Never `git add -A`, `git add .`, `git add -f`, or `git commit -a`. Never stage `.env`, `/media`, or build/test output (step 6). Committing is not editing: never modify tracked content to force a clean split. If a file genuinely mixes unrelated concerns, that is an ambiguity — ask (step 8).

6. **Run the safety gate before every commit**

   Read the full staged diff — not just the stat — then check:

   - **Secrets**: `PAYLOAD_SECRET=…`, credential-bearing `DATABASE_URL=postgres://user:pass@…`, API keys (including whatever map provider README names), tokens, `-----BEGIN … PRIVATE KEY`, `AKIA[0-9A-Z]{16}`. Never stage `.env` (gitignored) or `.env*.local`; `.env.example` carries placeholders only. Never copy the local `PAYLOAD_SECRET` or database password into tracked files, tests, docs, or `docker-compose.yml`. When unsure, `git check-ignore -v <path>`.
   - **Ignored and build output**: never force-add what `.gitignore` covers — `.next/`, `node_modules/`, `coverage/`, `test-results/`, `playwright-report/`, `blob-report/`, `/media`, `*.tsbuildinfo`, `next-env.d.ts`, `.vercel`, `.DS_Store`, `*.pem`.
   - **Generated code**: `src/payload-types.ts` (from `pnpm generate:types`), `src/app/(payload)/admin/importMap.js` (from `pnpm generate:importmap`), and `payload-generated-schema.ts` when present are tracked/regenerable and belong with their source change — but only as fresh output, never hand-edited. Regenerate after every schema/collection edit and re-stage.
   - **README invariants**: the public frontend is read-only — no forms, edit/delete buttons, or links that issue writes. Stop and report (step 8) if a staged change adds a write path to `src/app/(frontend)`, weakens collection access control so unauthenticated `POST`/`PATCH`/`DELETE` succeed, or otherwise contradicts README's admin-only editing model. The access-control layer is the enforcement point; a UI-only guard is not enough. If the integration spec does not yet assert the rejection, a change that relies on the guarantee must add or update that test in the same commit instead of assuming it exists.
   - **Environment consistency**: when DB or config wiring changes, `payload.config.ts`, `.env.example`, `docker-compose.yml`/`Dockerfile`, and README's "PostgreSQL" claim must tell the same story. A Postgres adapter with a Compose file that still starts Mongo is a discrepancy to raise, not to silently paper over.
   - **Build and tests**: run `pnpm exec tsc --noEmit` and `pnpm lint` for any TypeScript change; run `pnpm exec prettier --check <changed paths>` against `.prettierrc.json`. Run `pnpm test:int` for API/access-control/collection changes — it boots Payload against a live Postgres at `DATABASE_URL`, so start the database you normally use rather than assuming the template Compose file provides one. Run `pnpm test:e2e` for UI flows — Playwright starts `pnpm dev` itself. Run `pnpm build` when `next.config.ts`, app routes, or `payload.config.ts` change. If the database or browser cannot run, say so in the report; never claim a check passed unrun. Never commit a tree the commit itself breaks.
   - **Hooks**: never `--no-verify`. If a hook fails, fix the cause and re-stage.

7. **Commit and confirm the sequence**

   Capture the starting point first: `git rev-parse --verify HEAD` (a fresh repo has none — then treat the whole history as new and verify with plain `git log --oneline`).

   Commit each group with its single-line message (`git commit -m "<subject>"` and nothing after it), then re-run `git status --short` before starting the next group.

   Never `--amend` a commit that existed before this run or that may be pushed — check `git branch -r --contains <sha>`. If there are no remotes, nothing is pushed yet, but the rule still holds; a malformed message on the tip commit you just created may be fixed before reporting.

8. **Stop and ask when a grouping is ambiguous**

   Ask — with the concrete candidates, the exact paths or hunks each would take, and a recommended option — when:

   - a file's hunks mix unrelated concerns and cannot be split without editing it, especially shared generated files (`payload-types.ts`, `importMap.js`) touched by two collections;
   - a change plausibly belongs to two groups, or its tests/docs could accompany either of two commits;
   - formatting-only churn lands in files unrelated to the change;
   - a file's intent is genuinely unclear, or work is already partly committed so an amend would be needed;
   - credential-looking content appears in the diff — never rewrite history to remove an already-committed secret, stop and report it;
   - OpenSpec task tick-offs disagree with the code actually present;
   - the user's requested grouping conflicts with the dependency order;
   - the change contradicts README's read-only public frontend or admin-only mutation model.

   Otherwise proceed: the instruction is to ask on ambiguity, not to gate every commit.

9. **Verify and report**

   After the last commit, check the result:

   - `git log --oneline <original-head>..HEAD` — the commits, in order (plain `git log --oneline` when the repo had no HEAD before this run)
   - `git log --format='%h %s%n%b' <original-head>..HEAD` — every message is one line; a body on any of them is a defect. Fix it only if it is the tip commit created in this run and unpushed; otherwise report it rather than rewriting history.
   - `git status --short --untracked-files=all` — only intentionally-left changes remain

   Report each commit with its hash, message, and files/hunks; what was intentionally left uncommitted and why; anything the safety gate skipped; and any commit that did not come out self-contained.

**Guardrails**

- Never push, create or delete branches, rebase, reset, or drop stashes.
- Never rewrite pre-existing history — not even to remove a secret; stop and report instead.
- Never commit unless committing is what was asked for. If the user asked only for a grouping plan, present it instead.
- Never bypass hooks, force-add ignored files, or stage secrets to "fix it later".
- Grouping is a judgment call about the user's intent: when the diff does not settle it, ask rather than guess.
