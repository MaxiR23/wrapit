# AGENTS.md

Guidance for coding agents working in this repository.

## Project

wrapit — a personal kanban to organize tasks, built as a learning project on a
production-style stack.

Stack, status, setup, commands and layout: `README.md`. It is the single source
of truth for those lists; this file and `docs/` explain the rules and the why,
and never restate them.

## Structure

All application code lives under `src/`. The tree itself is listed in
`README.md`; what follows is the rule for deciding where a new file goes.

- `src/app/` — **routes only**: pages, layouts and route handlers. Keep it thin.
  A page composes; it does not implement. Anything a second route could ever
  want belongs in one of the layers below, not in the route folder.
- `src/components/` — React components, **grouped by domain** in a subdirectory:
  `auth/` today, `boards/` and `cards/` as those features land. A component used
  by a single route still lives here; the App Router routes by filename, so a
  component next to a page would be indistinguishable from a route.

  `ui/` is the exception: design-system primitives from shadcn/ui
  (`button`, `input`, `field`, …). Domain components consume them; do not put
  feature UI in `ui/`.

  Nothing else sits loose at the top of `src/components/`. A component belongs
  to the domain it serves, and a helper shared by that domain's components
  lives with them. Create a domain directory when its first component arrives;
  the flat list is what makes it unclear later which feature a file belongs to.
  Something genuinely shared by two domains moves up to `src/components/` only
  once a second domain actually uses it.

- `src/lib/` — shared code that is not a React component: the Better Auth
  instance and client, the Prisma client, route definitions, validation schemas.
- `src/actions/` — server actions, one per file, each starting with
  `'use server'`. Mutations that need the real session and Prisma live here
  (for example `createBoard`); auth sign-in/up still runs in the browser through
  `authClient`.
- `src/generated/` — generated output (the Prisma Client). Gitignored, recreated
  by `pnpm db:generate`, never edited by hand.
- `src/proxy.ts` — route protection. It must sit beside `src/app/`, not inside
  it: Next only detects the proxy convention at the project root or at `src/`.

Imports use the `@/` alias, which resolves to `src/`. It is declared twice and
the two must stay in sync: `paths` in `tsconfig.json` and `resolve.alias` in
`vitest.config.ts`. Relative imports are for siblings within a directory.

The alias reaches `src/` only. Tests import their own helpers relatively
(`../helpers/prismaFake`).

Dependencies point inwards: `app/` may import from `components/`, `actions/` and
`lib/`; `components/` may import from `actions/` and `lib/`; `lib/` imports from
nothing above it. Nothing outside `src/app/` imports a route.

## Conventions

- All code and comments in English. No emojis in code.
- Conventional Commits: `type: short description`, lowercase, one line.
- Use `pnpm` only. Never npm or yarn.

## Definition of done

1. Test first: red, green, refactor. See `docs/testing.md`.
2. Lint, format and build pass.
3. Tests for the change ship in the same branch and PR.
4. Relevant `docs/` updated.

## Roles

- Implementation: Claude Code.
- Review: Codex, read-only, before committing.
- Decisions and merge: the repo owner.
- Agents never run git commands (commit, push, merge). The owner handles all git.

## See also

    README.md               stack, commands, layout, setup
    docs/workflow.md        development workflow
    docs/tooling.md         formatters, linters, git hooks, test runner
    docs/testing.md         test conventions
    docs/architecture.md    layers, data flow, ownership, file map
    docs/kanban.md          boards, columns, cards, order, DnD
    docs/database.md        database and Prisma usage
    docs/auth.md            Better Auth and route protection
