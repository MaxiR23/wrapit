# Architecture

How the app is layered, how data moves, and where things live. Placement rules
for new files are in `AGENTS.md`; the top-level tree is in `README.md`.

## Layers

All application code sits under `src/`. Dependencies point inwards: `app/` may
import from `components/`, `actions/` and `lib/`; `components/` may import from
`actions/` and `lib/`; `lib/` imports from nothing above it. Nothing outside
`src/app/` imports a route.

- `src/app/` — **routes only**. A page composes; it does not implement domain
  logic. Keep it thin so a second route can reuse the same pieces.
- `src/components/` — React UI grouped by domain (`auth/`, `projects/`, `cards/`).
  `ui/` is the exception: shadcn/ui primitives. Feature UI never lands in `ui/`.
- `src/actions/` — server actions, one file each, each starting with
  `'use server'`. Mutations that need the real session and Prisma live here.
- `src/lib/` — shared non-UI code: Prisma, Better Auth, routes, validation,
  ownership helpers, kanban math.
- `src/generated/` — Prisma Client output. Gitignored; never edited by hand.
- `src/proxy.ts` — route protection. It must sit beside `src/app/`, not inside
  it: Next only detects the convention at the project root or at `src/`.

Imports use the `@/` alias (`src/`). It is declared in both `tsconfig.json` and
`vitest.config.ts`; those two must stay in sync. Tests import their own helpers
with relative paths.

## Data flow

Reads and writes take different paths on purpose.

**Reads** happen in Server Components. A page loads the session with
`auth.api.getSession({ headers: await headers() })`, then calls a lib helper
that scopes Prisma to that user — for example `listProjectsForUser` /
`listProjectSummariesForUser` / `listRecentProjectsForUser` /
`getProjectForUser` in `src/lib/projects.ts`,
and `getUserPreferences` in `src/lib/userPreferences.ts`. Missing or foreign
projects return `null`; the page turns that into `notFound()`. Recents are the
latest four owned projects the user opened; that cap is applied in the query
after the owner-only access filter. A missing
preferences row is not an error: the helper returns GRID defaults. The client
never talks to Prisma for project data. The projects list search filters those
already-loaded summaries in the client by title (case-insensitive includes).
Starred summaries sit in a Starred section above the main grid/list; recents
render as chips near the top.

**Writes** go through server actions under `src/actions/`. Each action checks
the real session, validates input, checks ownership, then mutates. Preferences
writes such as `updateViewMode` upsert the session user's 1:1 preferences row.
`createProject` creates a project for the session user (optional description,
status `NEW` | `IN_PROGRESS` | `PAUSED`, default `NEW`) and seeds columns in one
transaction: an optional `columns` list (1–8 titles; client `order` is sorted
then reassigned to `0..n-1`), or the blank template (**To do**, **In progress**,
**Done**) from `src/lib/templates.ts` when `columns` is omitted. When `featured`
is true it upserts the owner's membership with `starred: true` in that same
transaction via `upsertOwnerMembershipStarred`.
`setProjectStarred` writes `Membership.starred` to the given value (it does not
read-then-invert). If the owner has no membership row it upserts one with role
`OWNER` and that starred value through the same helper. `ProjectsView` shows
those writes immediately with `useOptimistic` inside `startTransition`, and
serializes them per project with the same coalescing loop as view-mode changes:
keep the latest desired value and an in-flight flag, write sequentially until
persisted matches that intent, and skip starting a second loop when a write is
already running.
Rapid toggles on one project never overlap; different projects stay independent.
On error the loop rolls the optimistic star back to the last persisted value
and `router.refresh()` reconciles to server data. `recordRecentProject`
upserts `openedAt` when the session user owns the project and no-ops otherwise,
so opening a project cannot fail navigation. Failures that should not leak internals
return a fixed generic message (`GENERIC_ERROR_MESSAGE` in `src/lib/messages.ts`).

**Auth in the browser** is the exception: sign up, sign in and sign out call
`authClient` against `/api/auth/*`. Everything else that changes domain data uses
an action.

**Route protection** in `src/proxy.ts` is navigation, not authorization. It only
looks for a session cookie and redirects. Anything that reads or writes user
data must still load the real session on the server. See `docs/auth.md`.

## Ownership

Every project belongs to one user (`ownerId`). Columns belong to projects; cards
belong to columns. Mutations walk that chain — card → column → project → user —
so a forged id for someone else's card cannot succeed.

`src/lib/ownership.ts` centralizes the lookups (`getColumnForUser`,
`getCardForUser`). Actions return `{ error: 'Unauthorized' }` when any link is
missing or not owned. That is deliberate: pages hide existence with `notFound()`;
mutations refuse without confirming whether the row exists for another user.

Extra rules for moving cards (same project, neighbors in the target column) live
in `docs/kanban.md`.

## Where things live

- **Validation** — zod schemas in `src/lib/validation/`, shared by forms and
  actions so browser and server cannot drift. `fieldErrors.ts` turns a zod
  failure into the first error per field.
- **Domain reads** — `src/lib/projects.ts` and ownership helpers, not pages.
- **Kanban DnD math** — pure helpers in `src/lib/` (`order.ts`, `kanbanItems.ts`,
  `kanbanPersist.ts`) so they can be tested without React. Behavior:
  `docs/kanban.md`.
- **Tests** — under `tests/`, mirroring `src/`. Conventions: `docs/testing.md`.

## File map

    src/proxy.ts                        route protection (cookie check only)
    src/lib/routes.ts                   public routes; PROJECTS_PATH, projectPath
    src/lib/auth.ts                     Better Auth instance (server)
    src/lib/authClient.ts               Better Auth client (browser)
    src/lib/email.ts                    Resend helper (password-reset email)
    src/lib/prisma.ts                   shared Prisma client
    src/lib/projects.ts                 list/load projects (detail + grid/list summaries + recents)
    src/lib/templates.ts                project template catalog (id, name, ordered column titles)
    src/lib/membership.ts               upsert owner Membership.starred (OWNER row)
    src/lib/userPreferences.ts          get-or-default user preferences (viewMode)
    src/lib/projectGrid.ts              progress, members, count, updated labels, title filter, recents summary map, optimistic starred reducer
    src/lib/initials.ts                 two-letter initials from name / username
    src/lib/ownership.ts                column/card ownership chain
    src/lib/messages.ts                 generic user-facing error string
    src/lib/order.ts                    Float order between neighbors
    src/lib/kanbanItems.ts              column→card id lists for DnD
    src/lib/kanbanPersist.ts            persist queue reconcile / finish
    src/lib/validation/fieldErrors.ts   first error per field
    src/lib/validation/signUp.ts        sign up rules
    src/lib/validation/signIn.ts        sign in rules
    src/lib/validation/forgotPassword.ts  forgot-password rules
    src/lib/validation/resetPassword.ts reset-password rules
    src/lib/validation/project.ts       project title, optional description/status/featured/columns
    src/lib/validation/column.ts        column title rules
    src/lib/validation/card.ts          card title and optional description
    src/lib/validation/moveCard.ts      moveCard id and neighbor rules
    src/lib/validation/viewMode.ts      projects grid/list viewMode
    src/actions/createProject.ts        create a project, optional column list, optional featured star
    src/actions/setProjectStarred.ts    write Membership.starred (owner may get an OWNER row)
    src/actions/recordRecentProject.ts  upsert RecentProject.openedAt on project open
    src/actions/updateViewMode.ts       persist the signed-in user's projects viewMode
    src/actions/createColumn.ts         create a column on an owned project
    src/actions/deleteColumn.ts         delete a column from an owned project
    src/actions/createCard.ts           create a card on an owned column
    src/actions/updateCard.ts           update an owned card
    src/actions/deleteCard.ts           delete an owned card
    src/actions/moveCard.ts             move/reorder a card (columnId + order)
    src/app/api/auth/[...all]/route.ts  Better Auth catch-all
    src/app/page.tsx                    / redirect-only: session to /projects, else /sign-in
    src/app/projects/page.tsx           projects shell, recents, starred, grid and list
    src/app/projects/[projectId]/page.tsx  project detail (owner only; else 404; records recent)
    src/app/(auth)/layout.tsx           auth split for sign-up, forgot, reset
    src/app/(auth)/sign-up/page.tsx     /sign-up
    src/app/(sign-in)/sign-in/layout.tsx  /sign-in: mobile hero, split from auth-sm
    src/app/(sign-in)/sign-in/page.tsx  /sign-in
    src/app/(auth)/forgot-password/page.tsx  /forgot-password
    src/app/(auth)/reset-password/page.tsx   /reset-password
    src/app/globals.css                 theme tokens (Neutral base) and form-island
    src/components/auth/                sign up, sign in, password reset, sign-in hero, AuthNav
    src/components/projects/ProjectsSearch.tsx  client search query for the projects list
    src/components/projects/            projects shell, grid, list, NewProjectDialog, ProjectKanban, column dialogs
    src/components/cards/               sortable cards, card dialogs
    src/components/ui/                  shadcn/ui primitives

## SEE

- `README.md` (Layout, Commands)
- `AGENTS.md` (Structure)
- `docs/auth.md`
- `docs/adr/0001-landing-hero-in-signin.md`
- `docs/database.md`
- `docs/kanban.md`
- `docs/testing.md`
