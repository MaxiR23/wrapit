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
- `src/components/` — React UI grouped by domain (`auth/`, `projects/`, `cards/`,
  `notifications/`, `account/`).
  `ui/` is the exception: shadcn/ui primitives. Feature UI never lands in `ui/`.
- `src/actions/` — server actions, one file each, each starting with
  `'use server'`. Mutations that need the real session and Prisma live here.
- `src/lib/` — shared non-UI code: Prisma, Better Auth, routes, validation,
  membership access, ownership chain helpers, kanban math.
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
and `getUserPreferences` in `src/lib/userPreferences.ts` /
`getUserProfileForUser` in `src/lib/userProfile.ts`. Missing or
inaccessible projects return `null`; the page turns that into `notFound()`. Recents are the
latest four accessible projects the user opened; that cap is applied in the query
after the membership access filter. A missing
preferences row is not an error: the helper returns GRID defaults. A missing
profile row is the same: empty fields and default visibilities (email
`admins`, everything else `anyone`). The client
never talks to Prisma for project data. The projects list search filters those
already-loaded summaries in the client by title (case-insensitive includes).
Starred summaries sit in a Starred section above the main grid/list; recents
render as chips near the top. Zero projects render `ProjectsEmptyState` instead
of that list (distinct from an empty search).

**Writes** go through server actions under `src/actions/`. Each action checks
the real session, validates input (bounded identifiers with `idSchema` before
any ownership or membership lookup), checks membership access, then mutates. Preferences
writes such as `updateViewMode` upsert the session user's 1:1 preferences row.
Profile writes (`updateProfileField`, `updateProfileVisibility`) upsert the
session user's 1:1 profile row the same way; they never take a user id from the
client. `publicName` writes `User.name`. The action returns the stored
(trimmed) value; `useProfileAutosave` writes that into the input so client
state matches the database without a reload. Email and local time are not writable
values in this slice. Rapid field edits use the same coalescing loop as view-mode
and stars so a slow response cannot overwrite a newer value.
Current-user avatar initials are derived in `DisplayNameProvider` from the live
display name and username; pages do not pass a snapshotted initials string.
Project member and notification avatars derive initials at render from name and
username.
Status reads (`getUserStatusesForUser`) seed four default `UserStatus` rows on
first read when the user has none, and heal a null `activeStatusId` to the
lowest-order row. Status writes (`setActiveStatus`, `updateUserStatusField`,
`createUserStatus`, `deleteUserStatus`) only touch the session user's rows; they
never take a user id from the client. Name, description, color, and the
active-status selection all go through `useProfileAutosave`. A successful write
always advances persisted, even if the user already moved on, so the loop can
send a correction. Only failures and superseded-but-unwritten responses are
discarded, using a request generation so A to B to C to B cannot treat the first
B's failure as the latest B. The last remaining status cannot be deleted:
`deleteUserStatus` locks the user row (`SELECT … FOR UPDATE`) at the start of
the transaction, then `assertNotLastStatus` counts remaining rows after a
conditional `deleteMany`. The lock keeps two overlapping deletes of the last
two rows from each counting the other's uncommitted row under READ COMMITTED.
Deleting the active status records that fact before `ON DELETE SET NULL` clears
`User.activeStatusId`, then writes the replacement in the same transaction.
The live active status (name + color) is held in `ActiveStatusProvider`.
`createProject` creates a project for the session user (optional description,
status `NEW` | `IN_PROGRESS` | `PAUSED`, default `NEW`) and seeds columns plus an
OWNER `Membership` in one transaction: an optional `columns` list (1–8 titles; client `order` is sorted
then reassigned to `0..n-1`), or the blank template (**To do**, **In progress**,
**Done**) from `src/lib/templates.ts` when `columns` is omitted. `Project.ownerId`
is creator metadata (still the session user). When `featured` is true the OWNER
row is created with `starred: true`; otherwise it is unstarred.
`setProjectStarred` writes `Membership.starred` to the given value (it does not
read-then-invert) and refuses with Unauthorized when the user has no membership.
`ProjectsView` shows
those writes immediately with `useOptimistic` inside `startTransition`, and
serializes them per project with the same coalescing loop as view-mode changes:
keep the latest desired value and an in-flight flag, write sequentially until
persisted matches that intent, and skip starting a second loop when a write is
already running.
Rapid toggles on one project never overlap; different projects stay independent.
On error the loop rolls the optimistic star back to the last persisted value
and `router.refresh()` reconciles to server data. `recordRecentProject`
upserts `openedAt` when the session user has a membership on the project and no-ops otherwise,
so opening a project cannot fail navigation. Failures that should not leak internals
return a fixed generic message (`GENERIC_ERROR_MESSAGE` in `src/lib/messages.ts`).

Notification reads load in the projects page Server Component via
`getNotificationsForUser` (session recipient only) so the bell badge is correct
on first paint. The panel refetches through `listNotifications` when opened.
Accepting an invitation from the panel calls `router.refresh()` so the
mounted `/projects` grid picks up the new membership. Reject does not
refresh. Mark-read writes (`markNotificationRead`, `markAllNotificationsRead`) only
touch the session user's rows: `markNotificationRead` is one `updateMany` on
`id` + `recipientId`. There is no polling and no websocket.

**Auth in the browser** is the exception: sign up, sign in and sign out call
`authClient` against `/api/auth/*`. Everything else that changes domain data uses
an action.

**Route protection** in `src/proxy.ts` is navigation, not authorization. It only
looks for a session cookie and redirects. Anything that reads or writes user
data must still load the real session on the server. See `docs/auth.md`.

## Access

A project is accessible when the user has a `Membership` on it, any role
(`OWNER`, `ADMIN`, `MEMBER`). `Project.ownerId` is creator metadata, not an
access filter. Columns belong to projects; cards belong to columns. Mutations
walk that chain — card → column → project → membership — so a forged id for
someone else's card cannot succeed.

`src/lib/membership.ts` owns the Prisma where clause (`accessibleByUser`) and the
last-OWNER invariant (`assertNotLastOwner` / `LastOwnerError`).
`src/lib/ownership.ts` centralizes the column/card lookups (`getColumnForUser`,
`getCardForUser`) using that where clause. Actions return `{ error: 'Unauthorized' }`
when any link is missing or the user is not a member. That is deliberate: pages
hide existence with `notFound()`; mutations refuse without confirming whether
the row exists for another user.

A project must keep at least one OWNER membership. `createProject` inserts the
creator's OWNER row in the same transaction as the project. `assertNotLastOwner`
throws `LastOwnerError` (`Cannot remove the last OWNER`) and does not write;
membership delete and role-change actions in a later slice must call it before
mutating.

Any member can invite by username (`createInvitation`). Non-invitable targets
(unknown username, self, already a member, existing PENDING invitation) return
the same generic message (`CANT_INVITE_USER_MESSAGE`) and write nothing; the
server logs the real reason. `inviteUserToProject` in `src/lib/invitations.ts`
owns those checks. Re-inviting after a reject claims `REJECTED` inside the
transaction (`updateMany` on `id` + `REJECTED`); a first-time insert claims
with `createMany` + `skipDuplicates`. A lost claim returns `pending_invitation`
and writes nothing. The invitee accepts or rejects; only the invitee can.
`acceptInvitation` runs in one transaction. The first write is a conditional
`updateMany` (`id` + `PENDING` → `ACCEPTED`); if that does not claim exactly
one row, the transaction rolls back and the action returns Unauthorized. Only
then: `MEMBER` membership, `INVITATION_ACCEPTED` for the inviter, delete the
invitee's `INVITATION_RECEIVED`. `rejectInvitation` is the same without the
membership write (`PENDING` → `REJECTED`). The invitee check stays outside the
transaction; the status check does not. Neither action reads `ownerId` for
access.

Extra rules for moving cards (same project, neighbors in the target column) live
in `docs/kanban.md`.

## Where things live

- **Validation** — zod schemas in `src/lib/validation/`, shared by forms and
  actions so browser and server cannot drift. `fieldErrors.ts` turns a zod
  failure into the first error per field.
- **Domain reads** — `src/lib/projects.ts` and membership/ownership helpers, not pages.
- **Kanban DnD math** — pure helpers in `src/lib/` (`order.ts`, `kanbanItems.ts`,
  `kanbanPersist.ts`) so they can be tested without React. Behavior:
  `docs/kanban.md`.
- **Tests** — under `tests/`, mirroring `src/`. Conventions: `docs/testing.md`.

## File map

    src/proxy.ts                        route protection (cookie check only)
    src/lib/routes.ts                   public routes; PROJECTS_PATH, projectPath, ACCOUNT_PATH, accountPath
    src/lib/auth.ts                     Better Auth instance (server)
    src/lib/authClient.ts               Better Auth client (browser)
    src/lib/email.ts                    Resend helper (password-reset email)
    src/lib/prisma.ts                   shared Prisma client
    src/lib/projects.ts                 list/load projects (detail + grid/list summaries + recents)
    src/lib/templates.ts                project template catalog (id, name, ordered column titles)
    src/lib/membership.ts               accessibleByUser, last-OWNER guard, owner backfill
    src/lib/invitations.ts              invite-by-username checks, notification copy
    src/lib/notifications.ts            list/mark-read for the session user's notifications
    src/lib/relativeTime.ts             relative English time without a leading verb
    src/lib/log.ts                      server-side info log (never sent to the client)
    src/lib/userPreferences.ts          get-or-default user preferences (viewMode)
    src/lib/userProfile.ts              get-or-default user profile (fields + visibility)
    src/lib/userStatus.ts               status tones, defaults, last-status guard, user-row lock
    src/lib/userStatuses.ts             read/seed per-user statuses (server only)
    src/lib/localTime.ts                12-hour local time with a GMT offset
    src/lib/projectGrid.ts              progress, members, count, updated labels, title filter, recents summary map, optimistic starred reducer
    src/lib/initials.ts                 two-letter initials from name / username (derived at render, not snapshotted)
    src/lib/ownership.ts                column/card access chain (membership)
    src/lib/messages.ts                 generic user-facing error strings
    src/lib/order.ts                    Float order between neighbors
    src/lib/kanbanItems.ts              column→card id lists for DnD
    src/lib/kanbanPersist.ts            persist queue reconcile / finish
    src/lib/validation/fieldErrors.ts   first error per field
    src/lib/validation/signUp.ts        sign up rules
    src/lib/validation/signIn.ts        sign in rules
    src/lib/validation/forgotPassword.ts  forgot-password rules
    src/lib/validation/resetPassword.ts reset-password rules
    src/lib/validation/id.ts            bounded identifier shared by action schemas
    src/lib/validation/invitation.ts    invite projectId + username; accept/reject invitationId
    src/lib/validation/notification.ts  markNotificationRead notificationId
    src/lib/validation/project.ts       project title, optional description/status/featured/columns/invitees
    src/lib/validation/projectAccess.ts recordRecentProject projectId; setProjectStarred projectId + starred
    src/lib/validation/column.ts        column title rules; create/delete action ids
    src/lib/validation/card.ts          card title and optional description; create/update/delete action ids
    src/lib/validation/moveCard.ts      moveCard card, column, and neighbor ids
    src/lib/validation/viewMode.ts      projects grid/list viewMode
    src/lib/validation/userProfile.ts   profile field values and per-field visibility
    src/lib/validation/userStatus.ts    status id, name, description, color
    src/actions/updateProfileField.ts   persist one profile field for the session user
    src/actions/updateProfileVisibility.ts  persist one profile visibility for the session user
    src/actions/setActiveStatus.ts      point User.activeStatusId at an owned status
    src/actions/updateUserStatusField.ts  persist one status field for the session user
    src/actions/createUserStatus.ts     append a custom status (cap 20)
    src/actions/deleteUserStatus.ts     delete an owned status; lock the user; refuse the last remaining
    src/actions/createProject.ts        create a project, OWNER membership, optional column list, optional featured star, optional invitees after commit
    src/actions/createInvitation.ts     invite a user by username (member only; generic deny)
    src/actions/acceptInvitation.ts     invitee accepts: membership MEMBER + notify inviter
    src/actions/rejectInvitation.ts     invitee declines and notifies the inviter
    src/actions/listNotifications.ts    session user's notifications (newest first) + unread count
    src/actions/markNotificationRead.ts mark one of the session user's notifications read
    src/actions/markAllNotificationsRead.ts mark every unread notification for the session user
    src/actions/setProjectStarred.ts    write Membership.starred for a member
    src/actions/recordRecentProject.ts  upsert RecentProject.openedAt on project open
    src/actions/updateViewMode.ts       persist the signed-in user's projects viewMode
    src/actions/createColumn.ts         create a column on an accessible project
    src/actions/deleteColumn.ts         delete a column from an accessible project
    src/actions/createCard.ts           create a card on an accessible column
    src/actions/updateCard.ts           update an accessible card
    src/actions/deleteCard.ts           delete an accessible card
    src/actions/moveCard.ts             move/reorder a card (columnId + order)
    src/app/api/auth/[...all]/route.ts  Better Auth catch-all
    src/app/page.tsx                    / redirect-only: session to /projects, else /sign-in
    src/app/projects/page.tsx           projects shell, recents, starred, grid/list, empty state
    src/app/account/page.tsx            account shell, tab routing, profile, visibility
    src/app/projects/[projectId]/page.tsx  project detail (member only; else 404; records recent; Members)
    src/app/(auth)/layout.tsx           auth split for sign-up, forgot, reset
    src/app/(auth)/sign-up/page.tsx     /sign-up
    src/app/(sign-in)/sign-in/layout.tsx  /sign-in: mobile hero, split from auth-sm
    src/app/(sign-in)/sign-in/page.tsx  /sign-in
    src/app/(auth)/forgot-password/page.tsx  /forgot-password
    src/app/(auth)/reset-password/page.tsx   /reset-password
    src/app/globals.css                 theme tokens (Neutral base) and form-island
    src/components/auth/                sign up, sign in, password reset, sign-in hero, AuthNav
    src/components/account/             account screen, profile tab, menu, display name, sign-out hook
    src/components/projects/ProjectsSearch.tsx  client search query for the projects list
    src/components/projects/            projects shell, grid, list, empty state, template picker, NewProjectDialog, ProjectKanban, column dialogs, OpenPanel exclusion, shellPanelClassName
    src/components/notifications/       bell, panel content, popover/sheet via shellPanelClassName, notifications provider
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
