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
  `notifications/`, `account/`, `labels/`, `tasks/`, `archived/`).
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
preferences row is not an error: the helper returns GRID defaults and all board
fields visible. A missing
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
writes such as `updateViewMode` and `updateBoardVisibility` upsert the session user's 1:1 preferences row.
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
Label reads (`getProjectLabelsForUser`) seed six default `Label` rows on first
board load when the project has none. Concurrent first reads collide on the
per-project order unique and retry the read. Label writes (`updateLabelField`,
`createLabel`, `deleteLabel`) are membership-based. Name and tone go through
`useProfileAutosave`. `deleteLabel` locks the project row, reassigns cards to
the first remaining label, then `assertNotLastLabel` counts remaining rows
after a conditional `deleteMany`. The last remaining label cannot be deleted.
At most 20 labels per project. Board cards render a pill only when
`Card.labelId` points at a known tone.
`createCard` validates ids before any lookup. Inside one transaction it
increments `cardCounter`, appends the card, stores the code, optional label and
due date, and `CardAssignee` rows. An empty assignee list writes the session
user. Label and assignee ids must belong to the target column's project
(count guards); a mismatch rolls back. After that occupancy write the same
transaction inserts one `ActivityEvent` (`CARD_CREATED`) so a logging failure
rolls the card back. `moveCard`, `archiveCard`, `deleteCard`,
`restoreArchivedCards`, `rearchiveArchivedCards`, `deleteArchivedCards`,
`archiveProject`, `restoreArchivedProjects`, `rearchiveArchivedProjects`,
`deleteArchivedProject`,
`updateCardAssignees`, `updateCardLabel`, due-date `updateCardField`,
`createComment`, `acceptInvitation`, and `removeMember` do the same for their
types. Title and description writes, subtasks, column/label CRUD, and
invitations are not logged. `createProject` writes `PROJECT_CREATED` in the
same transaction as the project and owner membership. `listActivityEvents`
is membership-gated (VIEW+) and pages with a createdAt+id keyset.
`listMyActivityEvents` is the same page for the session user as actor, across
projects they currently belong to.
Card detail writes follow the same pattern: `updateCardField` persists title,
description, or due date (returning `{ data: { value } }` for
`useProfileAutosave`, plus the resolved `dueDate` and `dueTimeZone` on the due
field so the board's copy of the card matches the row without the browser doing
zone arithmetic). A due write carries the day and, for a moment, the wall time
and the sender's IANA zone; the action resolves that to an instant. The stored
zone is the provenance of the moment, so a save that resolves to the instant
already stored keeps it, and only a genuinely new instant takes the sender's
zone. `updateCardAssignees` and `updateCardLabel` replace
those fields with membership/label count guards and go through the same
hook (debounce 0, one in-flight write per card) so overlapping replacements
cannot commit out of order; subtask done uses one in-flight write per
subtask and reverts that row only. `archiveCard` claims
`archivedAt: null` and writes `archivedById`. `createSubtask` appends
`(max order)+1`; subtask and comment mutations walk the card ownership chain.
`deleteCard` is `deleteMany` with a count guard on live cards (`archivedAt: null`);
comments and subtasks cascade. `restoreArchivedCards` clears archive fields in
one OWNER/ADMIN transaction and logs `CARD_RESTORED`; it refuses the batch when
a stored column is gone. In the same transaction it reads the pre-restore
`archivedAt` / `archivedById` itself and inserts a `RestoreUndoToken` (random id,
the session user, the project, five-minute expiry, JSON snapshot of those
values). Undo calls `rearchiveArchivedCards` with only that token; the action
claims the row (`userId` + unexpired), writes the stored metadata back, and
deletes the token. Expired rows are deleted on restore and on redeem
(`expiresAt <= now`); user and project deletes cascade the rest. A stale,
foreign, or cross-project token is Unauthorized and writes nothing.
`createProject` creates a project for the session user (optional description,
status `NEW` | `IN_PROGRESS` | `PAUSED`, default `NEW`) and seeds columns plus an
OWNER `Membership` in one transaction: an optional `columns` list (1–8 titles; client `order` is sorted
then reassigned to `0..n-1`), or the blank template (**To do**, **In progress**, **In review**,
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
(`OWNER`, `ADMIN`, `MEMBER`) and any board access (`EDIT`, `COMMENT`, `VIEW`).
`Project.ownerId` is creator metadata, not an access filter. Columns belong to
projects; cards belong to columns. Mutations walk that chain — card → column →
project → membership — so a forged id for someone else's card cannot succeed.

`src/lib/membership.ts` owns the Prisma where clauses (`accessibleByUser` for
any member of a live project, `withBoardAccess` for a minimum board access,
`administeredByUser` for OWNER/ADMIN team administration, and
`archivedAccessibleByUser` / `archivedAdministeredByUser` for the same on
archived projects). Live helpers include `archivedAt: null`. It also owns the last-OWNER invariant
(`assertNotLastOwner` / `LastOwnerError`). `src/lib/ownership.ts` centralizes
the column/card/label lookups (`getColumnForUser`, `getCardForUser`,
`getLabelForUser`) using `withBoardAccess`. Actions return `{ error: 'Unauthorized' }`
when any link is missing, the user is not a member, or their access is too
weak. That is deliberate: pages hide existence with `notFound()`; mutations
refuse without confirming whether the row exists for another user.

`Membership.role` governs the team: inviting, removing people, changing board
access, and toggling the public link. OWNER and ADMIN always have `EDIT` board
access (schema default plus a check constraint). `Membership.access` governs
the board: EDIT can create, edit, move, archive and delete cards, edit labels,
and comment; COMMENT can comment and check subtasks; VIEW is read only.
Existing memberships backfill to EDIT.

A project must keep at least one OWNER membership. `createProject` inserts the
creator's OWNER row in the same transaction as the project. `assertNotLastOwner`
throws `LastOwnerError` (`Cannot remove the last OWNER`) and does not write.
`removeMember` confirms the actor administers the project first, then calls
the guard, then `deleteMany` with a remaining-OWNER condition so two concurrent
last-owner deletes cannot land on zero owners. A caller who does not administer
the project gets Unauthorized even when the target is the last OWNER.
`removeMember` and `leaveProject` both unassign that user from the project's
cards (`unassignUserFromProject`); the cards stay.

Ownership moves only through `transferOwnership`. The actor must be OWNER.
The action demotes them to ADMIN (`EDIT`) then promotes the target to OWNER
(`EDIT`) in one transaction, each write a `updateMany` with `count === 1`. A
failed promote rolls the demote back, so a committed project never has zero
or two owners. Concurrent transfers serialize on the project row; the second
demote sees `count === 0`. `Project.ownerId` stays creator metadata.
`backfillOwnerMemberships` skips a project that already has an OWNER.

`leaveProject` deletes the session user's membership when `role` is not OWNER.
The owner check is that conditional delete, not a prior read; if it matches
zero rows, a follow-up read only chooses `OWNER_MUST_TRANSFER_MESSAGE` vs
Unauthorized. Admins and members leave freely. Recents for that user+project
are deleted. Rejoin needs a new invitation.

OWNER and ADMIN can invite by username (`createInvitation`). A MEMBER cannot.
Non-invitable targets
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
then: `MEMBER` membership with `COMMENT` access, `INVITATION_ACCEPTED` for the inviter, delete the
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
    src/lib/routes.ts                   public routes; PROJECTS_PATH, MY_TASKS_PATH, projectPath, projectCardPath, ACCOUNT_PATH, accountPath
    src/lib/auth.ts                     Better Auth instance (server)
    src/lib/authClient.ts               Better Auth client (browser)
    src/lib/email.ts                    Resend helper (password-reset email)
    src/lib/prisma.ts                   shared Prisma client
    src/lib/projects.ts                 list/load projects (detail + grid/list summaries + recents)
    src/lib/templates.ts                project template catalog (id, name, ordered column titles)
    src/lib/membership.ts               accessibleByUser, withBoardAccess, administeredByUser, archived counterparts, last-OWNER guard, unassign, owner backfill
    src/lib/boardAccess.ts              access labels, canEdit/canComment/canAdminister, ownership display, public board URL
    src/lib/invitations.ts              invite-by-username checks, notification copy
    src/lib/notifications.ts            list/mark-read for the session user's notifications
    src/lib/relativeTime.ts             relative English time without a leading verb
    src/lib/log.ts                      server-side info log (never sent to the client)
    src/lib/userPreferences.ts          get-or-default user preferences (viewMode, board visibility)
    src/lib/boardView.ts                board filters, search match, visibility defaults, summary
    src/lib/userProfile.ts              get-or-default user profile (fields + visibility)
    src/lib/userStatus.ts               status tones, defaults, last-status guard, user-row lock
    src/lib/userStatuses.ts             read/seed per-user statuses (server only)
    src/lib/localTime.ts                12-hour local time with a GMT offset
    src/lib/projectGrid.ts              progress, members, count, Done/inbox column helpers, title filter, recents summary map, optimistic starred reducer
    src/lib/initials.ts                 two-letter initials from name / username (derived at render, not snapshotted)
    src/lib/ownership.ts                column/card/label/subtask access chain (membership)
    src/lib/messages.ts                 generic user-facing error strings
    src/lib/order.ts                    Float order between neighbors
    src/lib/kanbanItems.ts              column→card id lists; append to a column
    src/lib/kanbanPersist.ts            persist queue reconcile / finish
    src/lib/cardCode.ts                 stored card code from project title + counter
    src/lib/cardDue.ts                  the one due formatter, overdue, day delta, calendar-day persist, zone math
    src/lib/cardCounters.ts             comment count and subtask done/total from the card lists
    src/lib/myTasks.ts                  assigned cards across projects, due groups, AND filters, open count
    src/lib/labelTones.ts               eight label tones mapped to CSS tokens
    src/lib/labels.ts                   defaults, last-label guard, project-row lock, card pill sync
    src/lib/accountActivity.ts          account Activity tab projects + assigned counts
    src/lib/activity.ts                 typed payloads, recordActivityEvent, listActivityForProject, listActivityForActor
    src/lib/activityCopy.ts             English activity sentences and chrome copy
    src/lib/activityDisplay.ts          sentence, clock, day groups, collapse
    src/lib/projectLabels.ts            read/seed per-project labels (server only)
    src/lib/board.ts                    mobile carousel, long-press, and drag-edge constants
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
    src/lib/validation/card.ts          card title, optional description/due date+time+zone/label/assignees; create/update/delete/archive/field action ids
    src/lib/validation/subtask.ts       subtask text and done; create/update/delete ids
    src/lib/validation/comment.ts       comment body; create cardId
    src/lib/validation/moveCard.ts      moveCard card, source, and target ids
    src/lib/validation/completeCard.ts  setCardCompleted cardId + completed
    src/lib/validation/viewMode.ts      projects grid/list viewMode
    src/lib/validation/boardVisibility.ts  six board-face visibility flags
    src/lib/validation/userProfile.ts   profile field values and per-field visibility
    src/lib/validation/userStatus.ts    status id, name, description, color
    src/lib/validation/label.ts         label id, name, tone; create projectId
    src/lib/validation/activity.ts      listActivityEvents projectId and optional cursor; listMyActivityEvents cursor
    src/actions/updateProfileField.ts   persist one profile field for the session user
    src/actions/updateProfileVisibility.ts  persist one profile visibility for the session user
    src/actions/setActiveStatus.ts      point User.activeStatusId at an owned status
    src/actions/updateUserStatusField.ts  persist one status field for the session user
    src/actions/createUserStatus.ts     append a custom status (cap 20)
    src/actions/deleteUserStatus.ts     delete an owned status; lock the user; refuse the last remaining
    src/actions/createProject.ts        create a project, OWNER membership, optional column list, optional featured star, optional invitees after commit
    src/lib/validation/membership.ts    update access, remove member, transfer, leave, public-link flag
    src/actions/createInvitation.ts     invite a user by username (OWNER/ADMIN only; generic deny)
    src/actions/acceptInvitation.ts     invitee accepts: MEMBER + COMMENT access + notify inviter
    src/actions/updateMembershipAccess.ts  OWNER/ADMIN set a MEMBER's board access
    src/actions/removeMember.ts         OWNER/ADMIN remove a person; last-OWNER guarded; unassign
    src/actions/transferOwnership.ts    OWNER hands the project to another member; demote then promote
    src/actions/leaveProject.ts         non-OWNER deletes own membership; unassign; drop recents
    src/actions/updatePublicLink.ts     OWNER/ADMIN persist Project.publicLinkEnabled
    src/actions/rejectInvitation.ts     invitee declines and notifies the inviter
    src/actions/listNotifications.ts    session user's notifications (newest first) + unread count
    src/actions/markNotificationRead.ts mark one of the session user's notifications read
    src/actions/markAllNotificationsRead.ts mark every unread notification for the session user
    src/actions/setProjectStarred.ts    write Membership.starred for a member
    src/actions/recordRecentProject.ts  upsert RecentProject.openedAt on project open
    src/actions/updateViewMode.ts       persist the signed-in user's projects viewMode
    src/actions/updateBoardVisibility.ts persist the signed-in user's board field visibility
    src/actions/createColumn.ts         create a column on an accessible project
    src/actions/deleteColumn.ts         delete a column from an accessible project
    src/actions/createCard.ts           create a card on an accessible column (code, counter, label, assignees, due date)
    src/actions/updateCard.ts           update an accessible card title and description
    src/actions/updateCardField.ts      persist one card title, description, or due date
    src/actions/updateCardAssignees.ts  replace assignees; membership count guard
    src/actions/updateCardLabel.ts      set or clear the card label
    src/actions/archiveCard.ts          set archivedAt and archivedById when archivedAt is null
    src/actions/restoreArchivedCards.ts restore archived cards to their stored column; mint undo token
    src/actions/rearchiveArchivedCards.ts redeem restore undo token; original archive metadata
    src/actions/deleteArchivedCards.ts  permanently delete archived cards
    src/actions/archiveProject.ts       set project archivedAt and archivedById when archivedAt is null
    src/actions/restoreArchivedProjects.ts restore archived projects; mint PROJECT undo token
    src/actions/rearchiveArchivedProjects.ts redeem project restore undo token
    src/actions/deleteArchivedProject.ts permanently delete one archived project (typed title)
    src/lib/archived.ts                 filter, sort, slice, and copy for archived tasks and projects
    src/lib/swipe.ts                    shared row-swipe thresholds and pointer gesture
    src/lib/archivedQuery.ts            load archived cards for a member (server-only)
    src/lib/archivedProjectsQuery.ts    load archived projects for a member (server-only)
    src/lib/archivedCopy.ts             English archived-screen copy
    src/lib/archivedExport.ts           CSV/JSON export of loaded rows
    src/lib/archivedScope.ts            tasks and projects scope adapters
    src/lib/restoreUndo.ts              undo-token id, ttl, expired-row cleanup
    src/lib/validation/archived.ts      restore, rearchive, delete, and archive-project schemas
    src/actions/createSubtask.ts        append a subtask on an accessible card
    src/actions/updateSubtaskField.ts   persist subtask text or done
    src/actions/deleteSubtask.ts        delete a subtask
    src/actions/createComment.ts        append a comment as the session user
    src/actions/listActivityEvents.ts   member-only project activity page (VIEW+)
    src/actions/listMyActivityEvents.ts  session user's events across current memberships
    src/actions/deleteCard.ts           delete a live card (occupancy on archivedAt null)
    src/actions/moveCard.ts             append a card to another column (occupancy guard)
    src/actions/setCardCompleted.ts     move a card to Done or inbox (EDIT, occupancy)
    src/actions/updateLabelField.ts     persist one label name or tone for a member
    src/actions/createLabel.ts          append a label (cap 20; seeds defaults if empty)
    src/actions/deleteLabel.ts          delete a label; reassign cards; refuse the last remaining
    src/app/api/auth/[...all]/route.ts  Better Auth catch-all
    src/app/page.tsx                    / redirect-only: session to /projects, else /sign-in
    src/app/projects/page.tsx           projects shell, recents, starred, grid/list, empty state
    src/app/tasks/page.tsx              My tasks shell: assigned cards across projects
    src/app/account/page.tsx            account shell, tab routing, profile, visibility, activity
    src/app/projects/[projectId]/page.tsx  project board in ProjectsShell (member only; archived project redirects to /archived; else 404; records recent; ?card= opens detail)
    src/app/projects/[projectId]/archived/page.tsx  archived tasks in ProjectsShell (member only; archived project redirects)
    src/app/archived/page.tsx           archived projects in ProjectsShell
    src/app/(auth)/layout.tsx           auth split for sign-up, forgot, reset, check-email, verify-email
    src/app/(auth)/sign-up/page.tsx     /sign-up
    src/app/(sign-in)/sign-in/layout.tsx  /sign-in: mobile hero, split from auth-sm
    src/app/(sign-in)/sign-in/page.tsx  /sign-in
    src/app/(auth)/check-email/page.tsx  waiting for verification email
    src/app/(auth)/verify-email/page.tsx  verification result
    src/app/(auth)/forgot-password/page.tsx  /forgot-password
    src/app/(auth)/reset-password/page.tsx   /reset-password
    src/app/globals.css                 theme tokens (Neutral base) and form-island
    src/components/auth/                sign up, sign in, check-email, verify-email, password reset, sign-in hero
    src/components/account/             account screen, profile, visibility, activity, menu, display name, sign-out hook
    src/components/projects/ProjectsSearch.tsx  client search query for the projects list
    src/components/projects/            projects shell, grid, list, empty state, template picker, NewProjectDialog, ProjectBoard, activity log, Share modal, board filters/visibility, archive confirm, viewer time zone, OpenPanel exclusion, shellPanelClassName
    src/components/notifications/       bell, panel content, popover/sheet via shellPanelClassName, notifications provider
    src/components/labels/              label editor and row (inline in new task)
    src/components/cards/               board cards, new-task dialog, card detail, due date+time control
    src/components/tasks/               My tasks list, rows, detail panel/sheet, two-step create
    src/components/archived/            archived list, row, detail, empty state, delete/export dialogs
    src/components/ui/                  shadcn/ui primitives

## SEE

- `README.md` (Layout, Commands)
- `AGENTS.md` (Structure)
- `docs/auth.md`
- `docs/adr/0001-landing-hero-in-signin.md`
- `docs/database.md`
- `docs/kanban.md`
- `docs/testing.md`
