# wrapit

A personal kanban to organize tasks. Learning project built to practice a
production-style stack and eventually contribute to similar codebases.

## Status

Stack and tooling are in place. Authentication covers sign up, sign in, sign out
and route protection. Boards can be listed, created and opened; columns and cards support create,
list, edit, delete, and drag-and-drop moves between columns (persisted). Card
metadata (due date, priority, labels) is not built yet.

The database runs in Docker; the app runs on the host with `pnpm dev`. A fully
dockerized mode is planned but not set up yet.

## Stack

- Next.js 16 (App Router, Server Components)
- TypeScript
- Tailwind CSS 4
- shadcn/ui (Neutral base; tokens in `src/app/globals.css`)
- Prisma 7 + PostgreSQL 18 (in Docker)
- Better Auth for authentication
- Vitest for tests, ESLint and Prettier for lint and format

## Prerequisites

- Node.js 22+
- pnpm
- Docker (for the database)

## Running

    git clone project-url
    cd wrapit
    cp .env.example .env      fill in the values
    pnpm install
    pnpm db:up                start Postgres in Docker
    pnpm db:migrate           apply migrations
    pnpm db:generate          generate the Prisma Client
    pnpm dev                  dev server at :3000

## Commands

    pnpm dev              dev server at :3000
    pnpm build            production build
    pnpm start            serve the production build
    pnpm lint             ESLint
    pnpm format           Prettier (write)
    pnpm format:check     Prettier (check only)
    pnpm test             run tests in watch mode
    pnpm test:run         run all tests once
    pnpm db:up            start Postgres in Docker
    pnpm db:down          stop the container
    pnpm db:migrate       create and apply a migration
    pnpm db:generate      regenerate the Prisma Client
    pnpm db:studio        open Prisma Studio
    pnpm db:reset         drop and recreate the database

## Layout

    src/app/        routes, layouts, pages (App Router)
    src/components/ React components: domain dirs (auth/, boards/, ...) and ui/ (shadcn)
    src/actions/    server actions (mutations)
    src/lib/        shared code (e.g. the Prisma client, utils)
    src/generated/  generated Prisma Client (gitignored)
    src/proxy.ts    route protection (Next 16's renamed middleware)
    prisma/         schema and migrations
    tests/          tests, mirroring the source structure
    docs/           tooling, testing and database documentation

What belongs in each directory: `AGENTS.md`.

## Checks

Run `pnpm lint`, `pnpm format` and `pnpm test:run` before committing. A
pre-commit hook runs lint-staged (ESLint and Prettier on staged files) and can
be skipped. See `docs/tooling.md`.

## Documentation

    docs/workflow.md           development workflow
    docs/tooling.md            formatters, linters, git hooks, test runner
    docs/testing.md            test conventions
    docs/database.md           database and Prisma usage
    docs/auth.md               Better Auth setup
    docs/repository-setup.md   GitHub settings that live outside this repo
