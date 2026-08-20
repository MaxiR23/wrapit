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

- `User` has many `Project`, many `Membership`, many `RecentProject`, many
  `UserStatus`, at most one `UserPreferences`, and at most one `UserProfile`.
  `activeStatusId` points at one of that user's statuses.
- `Project` belongs to a `User` as creator (`ownerId`) and has many `Column`,
  `Membership`, `Invitation`, and `RecentProject`. It
  has an optional `description` and a `status` (`ProjectStatus`: `NEW`,
  `IN_PROGRESS`, `PAUSED`, `DONE`, default `NEW`). Access is through
  `Membership` (roles `OWNER`, `ADMIN`, `MEMBER`); `ownerId` is creator metadata.
- `Membership` belongs to a `User` and a `Project`. One row per `(userId, projectId)`.
  It holds `role` and `starred`. Every project must have at least one OWNER.
- `Invitation` belongs to a `Project`, an inviter `User`, and an invitee `User`.
  One row per `(projectId, inviteeId)`. Status is `PENDING`, `ACCEPTED`, or
  `REJECTED`. Invites always write role `MEMBER`. A `REJECTED` row is reused
  (set back to `PENDING`) rather than inserting a second invitation. Reuse
  claims `REJECTED` with `updateMany` (`id` + `REJECTED`) so two overlapping
  re-invites cannot each write an `INVITATION_RECEIVED`. A first-time insert
  uses `createMany` with `skipDuplicates` so a concurrent create returns
  `pending_invitation` instead of throwing. Accept and
  reject claim `PENDING` with `updateMany` (`id` + `PENDING`) so only one
  status transition wins.
- `Notification` belongs to a recipient `User` and optionally an `Invitation`.
  `type` is `NotificationType`: `INVITATION_RECEIVED`, `INVITATION_ACCEPTED`,
  `INVITATION_REJECTED`. `invitationId` links the row so accept/reject can
  delete the invitee's received notification. `message` is denormalized English
  copy written at create time.
- `Column` belongs to a `Project` and has many `Card`.
- `Card` belongs to a `Column`.
- `RecentProject` belongs to a `User` and a `Project`. It records when that
  user last opened the project (`openedAt`). One row per `(userId, projectId)`.
- `UserPreferences` belongs to a `User`. It holds per-user UI settings. Today
  that is `viewMode` (`GRID` or `LIST`, default `GRID`). The table is meant to
  grow with more columns (for example language) on the same 1:1 row, without a
  new model.
- `UserProfile` belongs to a `User`. It holds optional profile fields
  (`fullName`, pronouns, job title, and so on) and a `ProfileVisibility`
  (`ANYONE`, `TEAM`, `ADMINS_ONLY`) per field, including photo, public name,
  local time, and email. Public name stays `User.name`; email stays `User.email`;
  local time is not stored. A missing row is not an error: reads return empty
  fields and the enum defaults (email visibility `ADMINS_ONLY`, everything else
  `ANYONE`). The first write upserts the session user's row. Visibility values
  are stored in this slice; they are not yet enforced when other users view a
  profile.
- `UserStatus` belongs to a `User`. It holds a display `name`, `description`,
  `color` (one of six palette keys: `green`, `gray`, `red`, `amber`, `blue`,
  `violet`), and an `Int` `order`. Statuses are per user and fully editable;
  there are no system-owned rows. A user with no rows is seeded on first read
  with Active, Inactive, Do not disturb, and Out of office; the first becomes
  `User.activeStatusId`. A missing `activeStatusId` with rows present is healed
  to the lowest-order row. The last remaining status cannot be deleted. Deleting
  a status sets `User.activeStatusId` to null when it pointed at that row
  (`onDelete: SetNull`); the delete action then points it at the previous status
  (or the new first row) when the deleted row was active. At most 20 statuses
  per user.

Deleting a record cascades to its children (deleting a project deletes its columns
and cards; deleting a user deletes their preferences, profile, and statuses). `Column` and `Card` use a
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
