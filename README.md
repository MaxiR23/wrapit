# wrapit

A personal kanban to organize tasks. Learning project built to practice a
production-style stack and eventually contribute to similar codebases.

## Status

Early setup. The stack and tooling are in place; application features (auth,
boards, cards) are not built yet.

The database runs in Docker; the app runs on the host with `pnpm dev`. A fully
dockerized mode is planned but not set up yet.

## Stack

- Next.js 16 (App Router, Server Components)
- TypeScript
- Tailwind CSS 4
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
    pnpm lint             ESLint
    pnpm format           Prettier (write)
    pnpm test:run         run all tests once
    pnpm db:up            start Postgres in Docker
    pnpm db:down          stop the container
    pnpm db:migrate       create and apply a migration
    pnpm db:generate      regenerate the Prisma Client
    pnpm db:studio        open Prisma Studio

## Layout

    app/            routes, layouts, pages (App Router)
    app/lib/        shared code (e.g. the Prisma client)
    proxy.ts        route protection (Next 16's renamed middleware)
    prisma/         schema and migrations
    tests/          tests, mirroring the source structure
    docs/           tooling, testing and database documentation

## Checks

Run manually:

    pnpm lint
    pnpm format
    pnpm test:run

Run automatically:

| Where      | What runs                      | Skippable |
| ---------- | ------------------------------ | --------- |
| pre-commit | lint-staged (ESLint, Prettier) | yes       |

## Documentation

    docs/workflow.md   development workflow
    docs/tooling.md    formatters, linters, git hooks, test runner
    docs/testing.md    test conventions
    docs/database.md   database and Prisma usage
    docs/auth.md       Better Auth setup
