# wrapit

A personal kanban to organize tasks. Learning project built to practice a
production-style stack and eventually contribute to similar codebases.

## Status

Stack and tooling are in place. Authentication covers sign up, email verification, sign in, sign out
and route protection. Projects can be listed, created and opened inside the
projects shell. The project board shows columns and cards, with desktop
drag-and-drop and a mobile carousel; moves persist by appending to the target
column. Card create/edit/delete dialogs exist but are not mounted on the board
yet. Card metadata (due date, priority, labels) is stored on the model and shown
when present; there is no editor for it on the board.

The database runs in Docker; the app runs on the host with `pnpm dev`. A fully
dockerized mode is planned but not set up yet.

## Planned work

Service links in card titles and descriptions currently derive their labels from
the URL alone. Fetching real titles and status from GitHub, Figma, Notion,
Google Docs, and Slack is a later slice. That connection will be per user
rather than per project, so nobody sees anything from a private repository they
could not already open themselves.

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
    pnpm build            apply pending migrations, generate client, production build
    pnpm start            serve the production build
    pnpm lint             ESLint
    pnpm format           Prettier (write)
    pnpm format:check     Prettier (check only)
    pnpm test             run tests in watch mode
    pnpm test:run         run all tests once
    pnpm db:up            start Postgres in Docker
    pnpm db:down          stop the container
    pnpm db:migrate       create and apply a migration (local/dev)
    pnpm db:deploy        apply pending migrations (production / CI)
    pnpm db:generate      regenerate the Prisma Client
    pnpm db:studio        open Prisma Studio
    pnpm db:reset         drop and recreate the database

## Layout

    src/app/        routes, layouts, pages (App Router)
    src/components/ React components: domain dirs (auth/, projects/, ...) and ui/ (shadcn)
    src/actions/    server actions (mutations)
    src/lib/        shared code (e.g. the Prisma client, utils)
    src/generated/  generated Prisma Client (gitignored)
    src/proxy.ts    route protection (Next 16's renamed middleware)
    prisma/         schema and migrations
    tests/          tests, mirroring the source structure
    docs/           architecture, auth, kanban, tooling and related docs

What belongs in each directory: `AGENTS.md`.

## Checks

Run `pnpm lint`, `pnpm format` and `pnpm test:run` before committing. A
pre-commit hook runs lint-staged (ESLint and Prettier on staged files) and can
be skipped. See `docs/tooling.md`.

## Documentation

    docs/workflow.md           development workflow
    docs/tooling.md            formatters, linters, git hooks, test runner
    docs/testing.md            test conventions
    docs/architecture.md       layers, data flow, ownership, file map
    docs/kanban.md             projects, columns, cards, order, DnD
    docs/database.md           database and Prisma usage
    docs/auth.md               Better Auth and route protection
    docs/repository-setup.md   GitHub settings that live outside this repo
