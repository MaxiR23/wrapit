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

**Reads** happen in Server Components. Authenticated routes load the session
through `getSession` in `src/lib/session.ts`, a `React.cache` wrapper around
`auth.api.getSession({ headers: await headers() })`. The authenticated layout
and the page both call it; one request validates once. `React.cache` is
request-scoped and does not survive to the next navigation. Server actions
still call `auth.api.getSession` themselves — they are a different request.
Any other read that the layout and a page would both do on one request goes
through `React.cache` the same way (`getSession`, `getAccountUser` on `/account`).
Then the page (and the layout, for shell data) call a lib helper
that scopes Prisma to that user — for example `listProjectsForUser` /
`listProjectSummariesForUser` / `listRecentProjectsForUser` /
`getBoardPageForUser` in `src/lib/projects.ts`,
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
The live board first paint is a slim payload: live cards with comment counts
and aggregated subtask progress, member identities for avatars, and the viewer's
membership for capabilities. The card query selects only face fields, so
description never leaves the database on that read; subtasks are grouped for
done/total rather than loaded as rows. Comment bodies, description, and share
admin fields load when those dialogs open (`getCardDetail`, `listProjectMembers`).
Hydrating card detail updates the displayed card only. It does not enter
`pendingCardWritesRef`, which exists so this user's own field edits survive a
columns refresh. Share members land in display state with a cancelled-flag
guard; they never touch that map. The board page omits `shareMembers`, so
changing `projectId` resets the lazy list and `shareListReady` instead of
waiting for a new array reference.
Archived lists are the same: first paint has counts and progress, not bodies.
The archived card query selects face fields so description never leaves the
database on that read, and groups subtasks by cardId and done, matching the
live board. Opening a row loads detail into the list row; export loads the selected cards'
details before serializing so a file is never written from the slim rows.
Export hydrates in `MAX_ARCHIVED_BATCH` chunks so a selection larger than that
limit still downloads; restore and delete keep the cap.

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
types. Title and description writes, subtasks, comment edits, column/label CRUD, and
invitations are not logged. `createProject` writes `PROJECT_CREATED` in the
same transaction as the project and owner membership. `listActivityEvents`
is membership-gated (VIEW+) and uses the shared pagination module with an
opaque cursor bound to the descending `createdAt` + `id` order.
`listMyActivityEvents` returns the same shared page result for the session user
as actor, across projects they currently belong to.
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
Comment edits also require `comment.authorId === session.user.id` after that
lookup, so OWNER and ADMIN cannot edit someone else's comment. Editing a
comment does not write an activity event or a notification.
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

Notification reads load in the authenticated layout (`src/app/(app)/layout.tsx`) via
`getUnreadNotificationCountForUser` (session recipient only) so the bell badge is
correct on first paint of the shell. The list is not loaded until the panel opens;
`NotificationsProvider` seeds the count and fetches through `listNotifications`
on open, showing a loading state so the empty copy does not flash. That list
uses the same epoch as archived lists: `refresh` captures it, and mark-read,
mark-all-read, accept, and reject advance it so a response that started before
the mutation cannot restore unread rows or the badge count. Accepting an
invitation from the panel calls `router.refresh()` so the
mounted `/projects` grid picks up the new membership. Reject does not
refresh. Mark-read writes (`markNotificationRead`, `markAllNotificationsRead`) only
touch the session user's rows: `markNotificationRead` is one `updateMany` on
`id` + `recipientId`. There is no polling and no websocket.

Those layout reads (unread count and the open-task badge) run when the
authenticated shell first mounts. They stay stale until a full refresh or an
existing client `router.refresh()`. `NotificationsProvider` adopts a new layout
count when it changes; the same count does not wipe a local mark-read. The bell
does not update as you navigate.
The open-task badge is `countOpenMyTasksForUser`: one SQL count with the same
membership and Done-column pick as `/tasks`. The Done column is
`doneColumnFrom` / `compareDoneColumnPick` (one titled Done, else last by
order; ties use id). The count query's `DISTINCT ON` is that comparator in
SQL, and the in-memory test client calls `doneColumnFrom`, so the badge and
the list cannot choose different columns. It does not share
`loadAssignedContext` with the list. `React.cache` still memoizes assigned
context for `listMyTasksForUser` internals on `/tasks` only. Neither memo keeps
the badge fresh across navigations.

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
access, changing MEMBER/ADMIN roles, and toggling the public link. OWNER and
ADMIN always have `EDIT` board access (schema default plus a check constraint).
`Membership.access` governs the board: EDIT can create, edit, move, archive and
delete cards, edit labels, and comment; COMMENT can comment, edit their own
comments, and check subtasks; VIEW is read only. Only the author can edit a
comment, including when the caller is OWNER or ADMIN. Comment edits are not
logged. Existing memberships backfill to EDIT.

On the live board, what the viewer can do comes from their row in the share
member list (`viewerProjectCapabilities`): role for administer, access for
edit and comment. `boardAccess` and `teamRole` are the fallback when that row
is missing, not a second source after the list has updated. The Share modal
uses the same helper.

OWNER and ADMIN promote a MEMBER to ADMIN, and demote an ADMIN to MEMBER,
through `updateMembershipRole`. The target cannot be OWNER; ownership still
moves only through `transferOwnership`. Promoting stores the current access in
`Membership.accessBeforeAdmin` and sets access to EDIT. Demoting restores that
value (EDIT when nothing is stored) and clears the column. Role and access are
one occupancy `updateMany`; a miss returns
`MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE` plus the committed `role` and
`access`, not Unauthorized. The Share row updates from that snapshot. If the
committed role is already the role the caller asked for (two administrators
made the same change), the row updates silently and the message is not shown.
A same-role request that never writes is a no-op. An admin may demote
themselves. The check sits after the
caller-administers check so a MEMBER targeting an OWNER is Unauthorized for
lack of administration, not a distinct owner-target path.
`assertNotLastOwner` is not used: this action never writes OWNER.

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
(`EDIT`, `accessBeforeAdmin` cleared) in one transaction, each write a
`updateMany` with `count === 1`. Becoming OWNER resets stored access history
so a later admin demotion lands on EDIT. A failed promote rolls the demote
back, so a committed project never has zero or two owners. Concurrent
transfers serialize on the project row; the second demote sees `count === 0`.
`Project.ownerId` stays creator metadata.
`backfillOwnerMemberships` skips a project that already has an OWNER.

`leaveProject` deletes the session user's membership when `role` is not OWNER.
The owner check is that conditional delete, not a prior read; if it matches
zero rows, a follow-up read only chooses `OWNER_MUST_TRANSFER_MESSAGE` vs
Unauthorized. Admins and members leave freely. Recents for that user+project
are deleted. Rejoin needs a new invitation.

OWNER and ADMIN can invite by username (`createInvitation`), choosing MEMBER
or ADMIN (default MEMBER). A MEMBER cannot. OWNER is not an invite role:
that payload fails parse and returns Unauthorized with no lookup.
Non-invitable targets
(unknown username, self, already a member, existing PENDING invitation) return
the same generic message (`CANT_INVITE_USER_MESSAGE`) and write nothing; the
server logs the real reason. `inviteUserToProject` in `src/lib/invitations.ts`
owns those checks and writes the chosen role on a first-time insert and on
REJECTED reuse (the new choice overwrites the stored role). Re-inviting after
a reject claims `REJECTED` inside the
transaction (`updateMany` on `id` + `REJECTED`); a first-time insert claims
with `createMany` + `skipDuplicates`. A lost claim returns `pending_invitation`
and writes nothing. The invitee accepts or rejects; only the invitee can.
`acceptInvitation` runs in one transaction. The first write is a conditional
`updateMany` (`id` + `PENDING` + the role and `inviterId` the caller read →
`ACCEPTED`); if that does not claim exactly
one row, the transaction rolls back and the action returns that the invitation
is no longer valid. REJECTED reuse can rewrite role and inviter, so the claim
describes the row the caller expected rather than re-reading after occupying
status. An ADMIN offer creates the membership as MEMBER, then claims ADMIN with
`updateMany` (`id` + `MEMBER` + `administeredByUser` for the inviter). A miss
leaves MEMBER; acceptance does not fail. Both paths write `EDIT` access and
`accessBeforeAdmin: null` (a later demotion of an invited ADMIN restores EDIT).
`MEMBER_ADDED` records the granted role. Then: `INVITATION_ACCEPTED` for the
inviter, delete the invitee's `INVITATION_RECEIVED`. `rejectInvitation` is the
same without the membership write (`PENDING` → `REJECTED`). The invitee check
stays outside the transaction; the status check does not. Neither action reads
`ownerId` for access.

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

## Pagination

A new list that needs pages uses the shared module, not a domain cursor.

1. The query calls `fetchPage` in `src/lib/pagination.ts` with a page size, an
   order (one sort field plus an id tie-break), optional opaque cursor, filter
   `where`, and `findMany`. It hydrates only `items`. It may still count the
   unscoped filter for a subtitle; that count is not completeness.
2. The action returns `PageResult` fields (`items` or the domain list, `hasMore`,
   `nextCursor`) and maps `InvalidPageCursorError` to Unauthorized. The cursor
   schema is an opaque string (`pageCursorSchema`). The shared module signs the
   cursor with `BETTER_AUTH_SECRET` and binds it to the request order: edited
   values and a date-sort cursor on a name-sort request are rejected. Changing
   the secret invalidates outstanding page cursors.
3. The client stores `hasMore` and `nextCursor` from the response (after any
   epoch check, in the same place as the rows) and renders
   `src/components/pagination/LoadMore.tsx`. Load more sends `nextCursor` as
   received and is disabled while that request is in flight. It does not
   compute remaining and does not build a cursor.

## Projects shell on the phone

Below `tablet` (600px) `ProjectsShell` pins the tab bar with `position: fixed`
to the bottom of the viewport. The outer nav is `tablet:hidden` and composes
`safe-inset-x` `safe-inset-b` so it sits on the safe rect, then padded with
`--spacing-mobile-tab-bar-inset`. The inner surface is a
4-column grid, `--radius-2xl`, `--mobile-tab-bar`, and `--shadow-mobile-tab-bar`.
That chrome is inline styles bound to those tokens so a missing utility cannot
collapse the row or square the pill. No `backdrop-filter`. Tab links use inset
focus rings because the surface clips overflow.
`--spacing-mobile-tab-bar` is the inner bar height. In-flow clearance on the
canvas is `--spacing-mobile-tab-bar-clearance` (height plus inset); the body
already consumed the bottom inset. Portaled overlays that sit in
`#safe-fixed-root` use clearance, not `--spacing-mobile-tab-bar-offset`: the
root already consumed the bottom inset. `--spacing-mobile-tab-bar-offset` is
clearance plus `safe-area-inset-bottom`, for in-tree viewport-fixed overlays
that are not descendants of the root. Desktop and tablet are unchanged
(`tablet:hidden`). Layout does not measure the viewport in JavaScript.

The phone column is `min-h-0` so a descendant `overflow-auto` can become a
scrollport. Default list content (projects grid, my tasks, archived) is
`overflow-auto` and `flex-1` only from `tablet`: below that it sizes to its
content and shrinks when long, so a short screen does not gain a scrollport.
The mobile search row on `/projects` is a child of that scroller, in flow
with the grid; it is not pinned. Board and account keep `overflow-hidden` on
the shell content (tab-bar padding there is clearance). The board's vertical
scroller is the column card list (and the activity log); the carousel item
wrapper is a bounded flex column (`h-full min-h-0 flex-col`) so
`BoardColumn`'s `flex-1 min-h-0` applies. Account scrolls the body under the
pinned tabs (`overflow-auto`, `flex-1` from `tablet` only).

## Safe-area canvas

`viewport-fit: cover` extends the document into the notch and home indicator.

- `body` padding on all four `env(safe-area-inset-*)` edges. In-flow chrome
  (the phone header, auth pages) sits inside that box. New in-flow UI picks
  this up by being a descendant of `body` and filling it with `h-full` /
  `min-h-full`, not `svh` / `dvh`.
- Portaled chrome mounts in `#safe-fixed-root`. That node is `position: fixed`
  to the four insets and `transform: translate(0)`, so it is the containing
  block for `position: fixed` descendants. `top-1/2` / `max-h-full` /
  `inset-x-4` / `bottom-0` are then relative to the safe rect, not the
  physical viewport. `DialogPortal` and `getSafeFixedRoot()` use that node.
  Overlay/scrim is the exception: mark it `data-safe-scrim` so it expands
  back to the physical viewport and the dim still paints into the notch.
- Full-screen phone dialogs pass `layout="cover"` and `coverUntil` on
  `DialogContent`. `coverUntil` is the theme breakpoint at which full-screen
  ends (`tablet` for the card dialogs, `md` for the templates dialog). Below
  that range, `dialog-phone-cover` fills the portal root (`inset: 0`,
  `height: auto`). It does not set `env()`: the root already consumed the
  insets. Above the range, the caller's own classes apply. The utility itself
  has no breakpoint. `coverUntil` is a theme breakpoint name, mapped to a
  complete `max-*` class so Tailwind can emit it; a later cover dialog
  declares an existing theme breakpoint. Do not pair `top-0` with `h-dvh`.
- In-tree edge-pinned `fixed` chrome (tab bar, auth bar, sheets that are not
  portaled) still composes `safe-inset-t` / `r` / `b` / `l` (and `x` / `y`)
  at the breakpoint it already uses. Pointer-positioned `fixed` (board drag
  ghost) stays viewport-relative so `clientX` / `clientY` match the box.

Enable `viewportFit: 'cover'` only with the body padding present. Land that
canvas in the same commit as cover, or in the commit before it.

jsdom does not compute `env()` and cannot prove the visual inset. Tests
assert the CSS contract, that portaled chrome mounts in `#safe-fixed-root`,
and that in-tree pins compose `layout="cover"` with a declared `coverUntil`,
or `safe-inset-*`. They do not prove pixel size on a notched device.

## Authenticated layout and loading

Signed-in routes sit in `src/app/(app)/`. That layout loads the session
through `getSession`, then an unread notification count and a SQL open-task
count, then
renders `ProjectsShell` around `{children}`. Path-dependent chrome (active nav,
search copy, content pane)
comes from `shellChromeForPath` inside a client `ShellFrame` that reads
`usePathname`, so it updates on navigation without remounting the shell.
`ProjectsSidebar` and `ProjectsMobileTabBar` sit under that client frame, so
they join the client bundle; screen `children` stay Server Components.

`ProjectBoard` always mounts both `BoardDesktop` (`hidden tablet:flex`) and
`BoardMobile` (`tablet:hidden`). Unifying those trees is a follow-up: two DnD
models, and it is a larger UI refactor than the first-paint fetch cuts.
`ArchivedView` similarly maps each row twice (`tablet:hidden` vs
`hidden tablet:block`); that is the same class of cost, not addressed here.

Each querying page has a `loading.tsx` sibling. Next.js uses that as the
Suspense fallback for the page slot only. Sidebar, topbar, phone header, and
tab bar stay mounted. The fallback is a `RouteSkeleton` (delayed CSS reveal,
no JS measurement) that mirrors the screen in that slot. `RouteSkeleton` is
`flex min-h-0 flex-1 flex-col` so it joins the same height chain as the page
it replaces; a block wrapper leaves `flex-1` on BoardLoading with nothing to
resolve against.

Search query is keyed by screen (`searchScopeForPath`), not one string on the
shell. `ShellFrame` passes that scope into `ProjectsSearchProvider`. The
provider stays mounted with the chrome, so a single query would leak from
`/projects` onto a board, `/tasks`, and `/archived`, and would stick on
`/account` where the input is hidden. Clearing on every pathname change
would also drop the query when opening a project from the filtered grid and
coming back. Account has no scope: the query is always empty.
Paged archived screens skip the first client refetch only when query, range,
and sort already match the server defaults (`archivedListIsDefault`); a
retained search must refetch so the rows and count match the query. That skip
does not advance the list epoch. Pages are a keyset on the active sort
(`archivedAt+id` for date, `title+id` for name), not an offset, so there is no
skip cap that can leave remaining rows unreachable. Completeness is `hasMore`
from fetching one row beyond the page size; `nextCursor` is an opaque string
the server encodes from the last returned row and the active order. The client
stores those fields and echoes the cursor; it does not compute remaining from
`totalCount` and does not build a cursor. `totalCount` is the subtitle only.
Each list page is one Repeatable Read snapshot: `count` and `fetchPage` share
a transaction so they agree on whether an id is included. List and count-only
requests send capped pending hidden ids (`excludeIds`, max 200, sorted). Shown
rows are accumulated server rows minus those hidden ids. Shown count uses the
last list or count-only `totalCount`. A list writer subtracts hidden ids that
are in that response's items and were not in its `excludeIds`. A count-only
writer is exact only for the ids it sent; leftover `lastPageIds` are not
subtracted. Each list and count-only request takes a sequence number at start.
A response writes `totalCount` (and a list response writes `lastPageIds`) only
when its sequence is newer than the last writer; an older list still applies
its rows and its `hasMore`/`nextCursor`. If the last count writer did not send
every currently hidden capped id, the client starts a count-only request with
the current capped set. At most one count-only request is in flight per hidden
set; requests stop once the last count writer sent every currently hidden
capped id. Ambiguous list responses keep their rows and refresh the count;
they never collapse View older. A too-narrow response (it excluded an id
marked stale by failure or undo) is not applied. After a failed hide, or after
a successful undo, a count-only request uses the current capped exclude ids so
the subtitle is not left excluding the unhidden row. The list collapses to the
first page only after a failed mutation, or after a successful undo whose row
is not in the accumulated rows. Mutations update the pending-hidden reducer;
they do not bump the list epoch, splice rows, or adjust `totalCount`. Failed
restore and Undo still insert on the non-paged path, and Undo on the paged path
unhides so the row reappears from leftover rows, using the same comparator as
the active sort. `router.refresh` does not reinitialise client list state.
The on-screen page is valid only for the filter it was fetched with
(`query`, `range`, `sort`). While that stamp differs from the current
controls, leftover rows and the count stay visible but pending: dimmed,
inert, `aria-busy`, no empty state, and no View older. A first-page
`{ error }` or rejected promise keeps that pending list and shows an inline
retry in place of View older; retry bumps the existing list-generation
refetch. Apply requires the list epoch **and** the requested filter to still
be current.

## File map

    src/proxy.ts                        route protection (cookie check only)
    src/lib/routes.ts                   public routes; PROJECTS_PATH, MY_TASKS_PATH, projectPath, projectCardPath, ACCOUNT_PATH, accountPath
    src/lib/safeFixedRoot.ts            #safe-fixed-root id; portaled chrome container
    src/lib/auth.ts                     Better Auth instance (server)
    src/lib/session.ts                  request-memoized getSession for Server Components
    src/lib/skipEmailVerification.ts    SKIP_EMAIL_VERIFICATION predicate (test-only)
    src/lib/authClient.ts               Better Auth client (browser)
    src/lib/email.ts                    Resend helpers (password-reset and verification emails)
    src/lib/emailLayout.ts              shared HTML + plain-text layout for those emails
    src/lib/prisma.ts                   shared Prisma client
    src/lib/projects.ts                 list/load projects (board page + grid/list summaries + recents)
    src/lib/accountUser.ts              request-memoized User row for account profile and statuses
    src/lib/cardDetail.ts               description, subtasks, and comments for an opened card (VIEW)
    src/lib/templates.ts                project template catalog (id, name, ordered column titles)
    src/lib/membership.ts               accessibleByUser, withBoardAccess, administeredByUser, archived counterparts, last-OWNER guard, unassign, owner backfill
    src/lib/boardAccess.ts              access labels, viewer capabilities, ownership display, public board URL
    src/lib/invitations.ts              invite-by-username checks, notification copy
    src/lib/notifications.ts            unread count and list/mark-read for the session user's notifications
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
    src/lib/ownership.ts                column/card/label/subtask/comment access chain (membership)
    src/lib/messages.ts                 generic user-facing error strings
    src/lib/order.ts                    Float order between neighbors
    src/lib/kanbanItems.ts              column→card id lists; append to a column
    src/lib/kanbanPersist.ts            persist queue reconcile / finish
    src/lib/cardCode.ts                 stored card code from project title + counter
    src/lib/cardDue.ts                  the one due formatter, overdue, day delta, calendar-day persist, zone math
    src/lib/serviceLinks.ts             recognised service URLs: match, labels, sanitised href
    src/lib/cardMarkdown.ts             closed markdown subset for card titles, descriptions, comments
    src/lib/markdownToolbar.ts          wrap a text selection with markdown markers
    src/lib/cardCounters.ts             comment count and subtask done/total from the card lists
    src/lib/myTasks.ts                  assigned cards across projects, due groups, AND filters; SQL open-task count; loadAssignedContext is React.cache for the list only
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
    src/lib/validation/invitation.ts    invite projectId + username + MEMBER/ADMIN role; accept/reject invitationId
    src/lib/validation/notification.ts  markNotificationRead notificationId
    src/lib/validation/project.ts       project title, optional description/status/featured/columns/invitees
    src/lib/validation/projectAccess.ts recordRecentProject projectId; setProjectStarred projectId + starred
    src/lib/validation/column.ts        column title rules; create/delete action ids
    src/lib/validation/card.ts          card title, optional description/due date+time+zone/label/assignees; create/update/delete/archive/field action ids
    src/lib/validation/subtask.ts       subtask text and done; create/update/delete ids
    src/lib/validation/comment.ts       comment body; create cardId; edit commentId
    src/lib/validation/moveCard.ts      moveCard card, source, and target ids
    src/lib/validation/completeCard.ts  setCardCompleted cardId + completed
    src/lib/validation/viewMode.ts      projects grid/list viewMode
    src/lib/validation/boardVisibility.ts  six board-face visibility flags
    src/lib/validation/userProfile.ts   profile field values and per-field visibility
    src/lib/validation/userStatus.ts    status id, name, description, color
    src/lib/validation/label.ts         label id, name, tone; create projectId
    src/lib/validation/activity.ts      activity action inputs with optional shared opaque cursor
    src/actions/updateProfileField.ts   persist one profile field for the session user
    src/actions/updateProfileVisibility.ts  persist one profile visibility for the session user
    src/actions/setActiveStatus.ts      point User.activeStatusId at an owned status
    src/actions/updateUserStatusField.ts  persist one status field for the session user
    src/actions/createUserStatus.ts     append a custom status (cap 20)
    src/actions/deleteUserStatus.ts     delete an owned status; lock the user; refuse the last remaining
    src/actions/createProject.ts        create a project, OWNER membership, optional column list, optional featured star, optional invitees after commit
    src/lib/validation/membership.ts    update access, update role, remove member, transfer, leave, public-link flag
    src/actions/createInvitation.ts     invite a user by username as MEMBER or ADMIN (OWNER/ADMIN only; generic deny)
    src/actions/acceptInvitation.ts     invitee accepts: MEMBER then occupancy ADMIN if inviter still administers; EDIT access; notify inviter
    src/actions/updateMembershipAccess.ts  OWNER/ADMIN set a MEMBER's board access
    src/actions/updateMembershipRole.ts OWNER/ADMIN promote MEMBER to ADMIN or demote ADMIN to MEMBER
    src/actions/removeMember.ts         OWNER/ADMIN remove a person; last-OWNER guarded; unassign
    src/actions/transferOwnership.ts    OWNER hands the project to another member; demote then promote; clears accessBeforeAdmin
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
    src/lib/pagination.ts               shared keyset page: take+1, hasMore, opaque nextCursor bound to order
    src/lib/archived.ts                 filter, sort, slice, and copy for archived tasks and projects
    src/lib/pendingHidden.ts            pending hidden ids for paged archived lists; shownCount
    src/lib/swipe.ts                    shared row-swipe thresholds and pointer gesture
    src/lib/archivedQuery.ts            paginated archived cards for a member (counts on the list, bodies on detail, viewer canAdminister)
    src/lib/archivedProjectsQuery.ts    paginated archived projects for a member (aggregates, no description)
    src/lib/archivedCopy.ts             English archived-screen copy
    src/lib/archivedExport.ts           CSV/JSON export; hydrate detail in MAX_ARCHIVED_BATCH chunks
    src/lib/archivedScope.ts            tasks and projects scope adapters
    src/lib/restoreUndo.ts              undo-token id, ttl, expired-row cleanup
    src/lib/validation/pagination.ts    opaque page cursor string bound
    src/lib/validation/archived.ts      restore, rearchive, delete, list, count, and detail schemas
    src/actions/createSubtask.ts        append a subtask on an accessible card
    src/actions/updateSubtaskField.ts   persist subtask text or done
    src/actions/deleteSubtask.ts        delete a subtask
    src/actions/createComment.ts        append a comment as the session user
    src/actions/updateComment.ts        author edits own comment (COMMENT+; occupancy on body)
    src/actions/listActivityEvents.ts   member-only project activity page (VIEW+)
    src/actions/getCardDetail.ts        VIEW-gated card description, subtasks, comments
    src/actions/listProjectMembers.ts   membership-gated share member list
    src/actions/listArchivedCards.ts    filtered, paginated archived cards (excludeIds)
    src/actions/listArchivedProjects.ts filtered, paginated archived projects (excludeIds)
    src/actions/countArchivedCards.ts   count-only archived cards (same filter and excludeIds)
    src/actions/countArchivedProjects.ts count-only archived projects (same filter and excludeIds)
    src/actions/getArchivedCardDetail.ts archived card description, subtasks, comments
    src/actions/getArchivedCardsDetail.ts batch archived card detail for export
    src/actions/getArchivedProjectDetail.ts archived project description
    src/actions/listMyActivityEvents.ts  session user's events across current memberships
    src/actions/deleteCard.ts           delete a live card (occupancy on archivedAt null)
    src/actions/moveCard.ts             append a card to another column (occupancy guard)
    src/actions/setCardCompleted.ts     move a card to Done or inbox (EDIT, occupancy)
    src/actions/updateLabelField.ts     persist one label name or tone for a member
    src/actions/createLabel.ts          append a label (cap 20; seeds defaults if empty)
    src/actions/deleteLabel.ts          delete a label; reassign cards; refuse the last remaining
    src/app/api/auth/[...all]/route.ts  Better Auth catch-all
    src/app/page.tsx                    / redirect-only: session to /projects, else /sign-in
    src/app/(app)/layout.tsx            authenticated shell: session, unread count, SQL open-task count
    src/app/(app)/projects/page.tsx     recents, starred, grid/list, empty state
    src/app/(app)/projects/loading.tsx  projects-grid slot fallback
    src/app/(app)/tasks/page.tsx        My tasks: assigned cards across projects
    src/app/(app)/tasks/loading.tsx     my-tasks slot fallback
    src/app/(app)/account/page.tsx      account tab routing, profile, visibility, activity
    src/app/(app)/account/loading.tsx   account slot fallback
    src/app/(app)/projects/[projectId]/page.tsx  project board (member only; archived project redirects to /archived; else 404; records recent; ?card= opens detail)
    src/app/(app)/projects/[projectId]/loading.tsx  board slot fallback
    src/app/(app)/projects/[projectId]/archived/page.tsx  archived tasks (member only; archived project redirects; canAdminister from getArchivedCardsForUser)
    src/app/(app)/projects/[projectId]/archived/loading.tsx  archived-tasks slot fallback
    src/app/(app)/archived/page.tsx     archived projects
    src/app/(app)/archived/loading.tsx  archived-projects slot fallback
    src/app/(auth)/layout.tsx           auth split for sign-up, forgot, reset, check-email, verify-email
    src/app/(auth)/sign-up/page.tsx     /sign-up
    src/app/(sign-in)/sign-in/layout.tsx  /sign-in: mobile hero, split from auth-sm
    src/app/(sign-in)/sign-in/page.tsx  /sign-in
    src/app/(auth)/check-email/page.tsx  waiting for verification email
    src/app/(auth)/verify-email/page.tsx  verification result
    src/app/(auth)/forgot-password/page.tsx  /forgot-password
    src/app/(auth)/reset-password/page.tsx   /reset-password
    src/app/globals.css                 theme tokens (Neutral base) and form-island
    src/components/ScreenHeader.tsx     shared screen identity (title/breadcrumb, inset tokens)
    src/components/mobileChrome.ts      phone add button, searchFieldDomProps
    src/components/auth/                sign up, sign in, check-email, verify-email, password reset, sign-in hero
    src/components/account/             account screen, profile, visibility, activity, menu, display name, sign-out hook
    src/components/projects/searchScope.ts  pathname to per-screen search key; account has none
    src/components/projects/ProjectsSearch.tsx  client search queries keyed by screen
    src/components/projects/            projects shell, grid, list, empty state, template picker, NewProjectDialog, ProjectBoard, activity log, Share modal, board filters/visibility, archive confirm, viewer time zone, OpenPanel exclusion, shellPanelClassName
    src/components/notifications/       bell, panel content, popover/sheet via shellPanelClassName, notifications provider
    src/components/labels/              label editor and row (inline in new task)
    src/components/cards/               board cards, new-task dialog, card detail, due date+time control, markdown and service-link text
    src/components/tasks/               My tasks list, rows, detail panel/sheet, two-step create
    src/components/archived/            archived list, row, detail, empty state, delete/export dialogs
    src/components/pagination/          shared Load more control (hasMore + opaque nextCursor)
    src/components/ui/                  shadcn/ui primitives, including skeleton
    src/components/projects/searchScope.ts  pathname to per-screen search key; account has none
    src/components/projects/shellChrome.ts  pathname to shell chrome props
    src/components/projects/ShellFrame.tsx  client frame: usePathname plus sidebar, header, topbar, tab bar
    src/components/projects/ProjectsLoading.tsx  projects-grid slot skeleton
    src/components/projects/BoardLoading.tsx  board slot skeleton
    src/components/tasks/MyTasksLoading.tsx  my-tasks slot skeleton
    src/components/archived/ArchivedLoading.tsx  archived slot skeleton
    src/components/account/AccountLoading.tsx  account slot skeleton

## SEE

- `README.md` (Layout, Commands)
- `AGENTS.md` (Structure)
- `docs/auth.md`
- `docs/adr/0001-landing-hero-in-signin.md`
- `docs/database.md`
- `docs/kanban.md`
- `docs/testing.md`
