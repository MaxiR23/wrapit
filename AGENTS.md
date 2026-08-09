# AGENTS.md

Guidance for coding agents working in this repository.

## Project

wrapit — a personal kanban to organize tasks. Learning project on a
production-style stack: Next.js 16 (App Router), TypeScript, Tailwind 4,
Prisma 7, PostgreSQL 18 (Docker), Vitest, pnpm.

Status: early setup. Stack and tooling are in place. Auth covers sign up, sign in
and sign out; route protection, boards and cards are not built yet.

## Commands

    pnpm dev              dev server at :3000
    pnpm build            production build
    pnpm lint             ESLint
    pnpm format           Prettier (write)
    pnpm test:run         run all tests once
    pnpm db:up            start Postgres in Docker
    pnpm db:migrate       create and apply a migration
    pnpm db:generate      regenerate Prisma Client

## Layout

    app/            routes, layouts, pages (App Router)
    app/components/ React components
    app/lib/        shared code (e.g. the Prisma client)
    prisma/         schema and migrations
    tests/          tests, mirroring the source structure
    docs/           tooling, testing and database documentation

## Conventions

- All code and comments in English. No emojis in code.
- Conventional Commits: `type: short description`, lowercase, one line.
- Use `pnpm` only. Never npm or yarn.

## Definition of done

1. Lint, format and build pass.
2. Tests for the change ship in the same branch and PR.
3. Relevant `docs/` updated.

## Roles

- Implementation: Claude Code.
- Review: Codex, read-only, before committing.
- Decisions and merge: the repo owner.
- Agents never run git commands (commit, push, merge). The owner handles all git.

## See also

    docs/workflow.md   development workflow
    docs/tooling.md    formatters, linters, git hooks, test runner
    docs/testing.md    test conventions
    docs/database.md   database and Prisma usage
    docs/auth.md       Better Auth setup
