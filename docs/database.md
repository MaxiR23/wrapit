# Database

How the database is set up and how to work with it locally. PostgreSQL runs only
in Docker; the Next.js app runs on the host. The `db:*` commands are listed in
`README.md`.

## Environment variables

The database reads its config from `.env` (never committed). See `.env.example`
for the required variables:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` — used by
  the Docker container.
- `DATABASE_URL` — used by Prisma to connect.
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` — used by Better Auth. See
  `docs/auth.md`.

## Running the database

`pnpm db:up` starts Postgres in the background, `pnpm db:down` stops it.

The Postgres 18 image declares its volume at `/var/lib/postgresql` (this changed
in version 18; it was `/var/lib/postgresql/data` in 17 and below). The
docker-compose file mounts the volume at the new path.

See: https://hub.docker.com/_/postgres

## Schema

Defined in `prisma/schema.prisma`. The models and their relations:

- `User` has many `Project` and at most one `UserPreferences`.
- `Project` belongs to a `User` and has many `Column`.
- `Column` belongs to a `Project` and has many `Card`.
- `Card` belongs to a `Column`.
- `UserPreferences` belongs to a `User`. It holds per-user UI settings. Today
  that is `viewMode` (`GRID` or `LIST`, default `GRID`). The table is meant to
  grow with more columns (for example language) on the same 1:1 row, without a
  new model.

Deleting a record cascades to its children (deleting a project deletes its columns
and cards; deleting a user deletes their preferences). `Column` and `Card` use a
`Float` `order` field so siblings can be reordered without rewriting every row on
each move. Midpoints, renumbering when precision runs out, and how the UI
persists moves: `docs/kanban.md`.

`User`, `Session`, `Account` and `Verification` are owned by Better Auth.
Passwords live on `Account`, not on `User`. See `docs/auth.md`.

## Prisma commands

`pnpm db:migrate` asks for a migration name before creating and applying it, and
`pnpm db:reset` drops the database and replays every migration from scratch.

In Prisma 7, `migrate` does not generate the client automatically. Run
`pnpm db:generate` after schema changes.

See: https://www.prisma.io/docs/orm

## Prisma Client

The client is created in `src/lib/prisma.ts`. Prisma 7 requires an explicit
driver adapter, so the client is built with `@prisma/adapter-pg` using
`DATABASE_URL`. A single instance is reused across hot reloads in development to
avoid exhausting database connections.

The generated client lives in `src/generated/prisma` and is gitignored; it is
recreated with `pnpm db:generate`.

See: https://www.prisma.io/docs/orm/prisma-client

## First-time setup

See the Running section of `README.md`.
