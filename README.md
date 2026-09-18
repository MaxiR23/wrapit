# wrapit

A personal kanban to organize tasks. Learning project built to practice a
production-style stack and eventually contribute to similar codebases.

## Status

Authentication covers sign up, email verification, password reset, sign in,
sign out and route protection. The projects shell includes project lists,
boards, archives, notifications, account settings and personal tasks. Boards
support columns and cards, desktop drag-and-drop, a mobile carousel, card
details and editing, labels, assignees, subtasks, comments and activity.

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
- pnpm 11 (the version in `package.json` is 11.20.0)
- Docker (for the database)

## Running

1. Clone the repository, then install dependencies:

   ```bash
   git clone https://github.com/MaxiR23/wrapit.git
   cd wrapit
   pnpm install
   ```

2. Copy `.env.example` to `.env`. Set `POSTGRES_USER`, `POSTGRES_PASSWORD`,
   `POSTGRES_DB` and `POSTGRES_PORT`, and make `DATABASE_URL` use the same
   credentials, database and host port. Set `BETTER_AUTH_URL` to
   `http://localhost:3000`, generate `BETTER_AUTH_SECRET` with
   `openssl rand -base64 32`, and set `RESEND_API_KEY` for verification and
   password-reset email. See [database setup](docs/database.md) and
   [authentication](docs/auth.md) for the variables and email behavior.

   ```bash
   cp .env.example .env
   ```

3. Start Docker, apply the migrations already in the repository, generate the
   Prisma Client and start the app:

   ```bash
   pnpm db:up
   pnpm db:deploy
   pnpm db:generate
   pnpm dev
   ```

   Open `http://localhost:3000`. Use `pnpm db:migrate` only when changing the
   schema locally and creating a new migration.

## Commands

    pnpm dev              dev server at :3000
    pnpm build            generate client, production build
    pnpm start            serve the production build
    pnpm lint             ESLint
    pnpm format           Prettier (write)
    pnpm format:check     Prettier (check only)
    pnpm test             run tests in watch mode
    pnpm test:run         run all tests once
    pnpm verify           lint, format check, tsc, tests, then build; stops at first failure
    pnpm db:up            start Postgres in Docker
    pnpm db:down          stop the container
    pnpm db:migrate       create and apply a new migration (local schema changes)
    pnpm db:deploy        apply existing pending migrations without creating one
    pnpm db:generate      regenerate the Prisma Client
    pnpm db:studio        open Prisma Studio
    pnpm db:reset         drop and recreate the database

On Vercel, `vercel.json` runs `pnpm db:deploy && pnpm build`. The build generates
the Prisma Client; `db:deploy` applies migrations first. Configure the hosted
database and the app's environment variables in Vercel. See
[database deployment](docs/database.md) and [authentication](docs/auth.md).

## Layout

    src/
      app/          App Router routes, pages, layouts and route handlers
      actions/      server actions
      components/   domain UI (account/, archived/, auth/, cards/, labels/,
                    notifications/, pagination/, projects/, tasks/) and ui/
      lib/          shared queries, auth, pagination and validation
      generated/    generated Prisma Client (gitignored)
      proxy.ts      route protection
    prisma/         schema and migrations
    scripts/        verification and Git hook helpers
    tests/          tests mirroring the source structure
    docs/           architecture and feature guidance, plus adr/

See [AGENTS.md](AGENTS.md) for placement rules and
[architecture](docs/architecture.md) for data flow and ownership.

## Checks

`pnpm verify` is the local gate: lint, format check, `tsc --noEmit`, tests,
then the production build, stopping at the first failure. A pre-push hook
refuses the push unless the updated ref is the clean checked-out HEAD, then
runs `pnpm verify` and blocks the push if any step fails, including when a
step cannot run because of the environment. A
pre-commit hook runs lint-staged (ESLint and Prettier on staged files). See
[tooling](docs/tooling.md) and [workflow](docs/workflow.md).

## Documentation

    docs/adr/                architecture decision records
    docs/architecture.md     layers, data flow and ownership
    docs/auth.md             Better Auth and route protection
    docs/database.md         database and Prisma usage
    docs/kanban.md           projects, columns, cards, order and DnD
    docs/repository-setup.md GitHub settings outside this repo
    docs/testing.md          test conventions
    docs/theming.md          theme and visual tokens
    docs/tooling.md          formatters, linters, hooks and test runner
    docs/workflow.md         development workflow
