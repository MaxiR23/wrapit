# Database

How the database is set up and how to work with it locally.

## Stack

- PostgreSQL 18, running in Docker.
- Prisma 7 as the ORM.
- The database runs only in Docker; the Next.js app runs on the host with
  `pnpm dev`.

## Environment variables

The database reads its config from `.env` (never committed). See `.env.example`
for the required variables:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` — used by
  the Docker container.
- `DATABASE_URL` — used by Prisma to connect.

## Running the database

    pnpm db:up        start Postgres in the background
    pnpm db:down      stop the container

The Postgres 18 image declares its volume at `/var/lib/postgresql` (this changed
in version 18; it was `/var/lib/postgresql/data` in 17 and below). The
docker-compose file mounts the volume at the new path.

See: https://hub.docker.com/_/postgres

## Schema

Defined in `prisma/schema.prisma`. The models and their relations:

- `User` has many `Board`.
- `Board` belongs to a `User` and has many `Column`.
- `Column` belongs to a `Board` and has many `Card`.
- `Card` belongs to a `Column`.

Deleting a record cascades to its children (deleting a board deletes its columns
and cards). `Column` and `Card` use a `Float` `order` field to allow reordering
without renumbering every sibling.

## Prisma commands

    pnpm db:migrate       create and apply a migration (asks for a name)
    pnpm db:generate      regenerate the Prisma Client
    pnpm db:studio        open Prisma Studio (visual DB browser)
    pnpm db:reset         drop and recreate the database from scratch

In Prisma 7, `migrate` does not generate the client automatically. Run
`pnpm db:generate` after schema changes.

See: https://www.prisma.io/docs/orm

## Prisma Client

The client is created in `app/lib/prisma.ts`. Prisma 7 requires an explicit
driver adapter, so the client is built with `@prisma/adapter-pg` using
`DATABASE_URL`. A single instance is reused across hot reloads in development to
avoid exhausting database connections.

The generated client lives in `app/generated/prisma` and is gitignored; it is
recreated with `pnpm db:generate`.

See: https://www.prisma.io/docs/orm/prisma-client

## First-time setup

For someone cloning the repo:

1. Copy `.env.example` to `.env` and fill in the values.
2. `pnpm install`
3. `pnpm db:up`
4. `pnpm db:migrate`
5. `pnpm db:generate`
