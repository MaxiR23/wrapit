# Kanban

How projects, columns and cards work: membership access, card codes, column
moves, and the optimistic persist queue. App layering and the general file map:
`docs/architecture.md`. Schema and Prisma setup: `docs/database.md`.

## Domain

Hierarchy: **Project → Column → Card**. A project has a creator (`Project.ownerId`)
and is accessed through `Membership` (any role). Deleting a
project or column cascades to its children, so mutations do not need orphan
cleanup.

`createProject` accepts an optional ordered column list (`title` + client
`order`). It validates titles (trimmed, non-empty), requires 1–8 columns, then
sorts by the provided order and reassigns `0..n-1` so client order values are
never trusted. When `columns` is omitted, it seeds the **blank** template
(**To do**, **In progress**, **In review**, **Done**) from `src/lib/templates.ts`. Columns and an
OWNER `Membership` for the session user are created in the same transaction as
the project. A create-time `featured` flag sets `starred: true` on that OWNER
row; otherwise it is unstarred.

Any member can invite another user by username. Invites always create a
`MEMBER` role. `acceptInvitation` claims `PENDING` with a conditional
`updateMany` inside the transaction, then inserts the membership; a concurrent
reject or a second accept cannot leave a membership on a non-PENDING row. A
mid-flight failure rolls back. Access for invite, accept, and reject is
membership-based, never `ownerId`.

`Column` and `Card` both carry a `Float` `order`. Creates still append with
`(max order in parent) + 1`. The board UI moves cards **between columns only**
and always appends to the target; intra-column reorder is stored for later and
is not exposed in the UI.

`Card.code` is assigned at create time as `{initials(project.title)}-{n}` (for
example `RS-14`), using the same `initials()` helper as avatars (first and last
word). Empty titles fall back to `PR`. `Project.cardCounter` increments atomically
inside the create transaction (`increment: 1`); renaming the project or the card
does not rewrite stored codes. `Card.archivedAt` hides a card from board reads
when it is set. Archive from the card detail writes `archivedAt` with a
count guard (`archivedAt: null`); delete hard-removes the card and cascades
comments and subtasks.

`createProject` also accepts optional `invitees` (usernames). The list is
validated with the project (strings only, username length bounds, at most 20
after dedup); a field error means nothing is created. After the project
transaction commits, each unique username is invited (trimmed, lowercased,
duplicates dropped). Invalid invitees are
collected as `inviteErrors` and do not roll back the project. The new-project
dialog always closes on success and may show a brief notice when some invites
failed; remaining invites happen from Members on the project page.

The project detail page loads ordered columns and visible cards (those with
`archivedAt` unset) server-side via `getProjectForUser`, and project labels via
`getProjectLabelsForUser` (seeding six defaults when the project has none).
Non-members get `notFound()`. Cards with a `labelId` render a pill from
`cardLabelFromRow`; unlabeled cards omit it. Clicking a board card opens the
detail dialog: title, description, due date, assignees, label, and subtask
done all go through `useProfileAutosave` (debounce 0 for assignees, label,
and done). One write is in flight per card for assignees and for label, and
per subtask for done; a successful stale response still advances persisted
so the loop can write the correction. Column writes immediately and updates
the board without a remount. Subtasks (add, rename, check, remove)
and comments (create) live on the card; footer counters on the board face
are derived from those lists (`commentCount` / `subtaskProgress` in
`src/lib/cardCounters.ts`), including `0` and `0/0`. Archive and delete
close the dialog, drop the card from the board, and show a board toast.

The new-task dialog opens from a
column plus with that column preselected. Its pencil opens the same `LabelEditor`
used for project labels: renaming a label updates every card that points at it;
removing one reassigns those cards to the first remaining label. The last label
cannot be removed. Create is disabled without a title. The card is appended to
the chosen column with the next stored code. Assignees are members of the
project; if none are picked, the creator is assigned. `Card.dueDate` is an
optional calendar day stored as UTC midnight and shown through `formatCardDue`
/ `isCardDueLate`. Overdue and Today / Yesterday / Tomorrow use the viewer's
local calendar day, not UTC.

The page sits in `ProjectsShell` with Projects as the active nav
and search hidden. The client owns an id list per column; a move persists
`cardId` + `sourceColumnId` + `targetColumnId`. Display order is the id list;
the server appends with `(max order in the target) + 1`.

## Progress on the projects grid

`listProjectSummariesForUser` computes **done / total** from real cards. A card
counts as done when its column title is `Done` (case-insensitive). If the project
has no such column, the last column by `order` is treated as done. No cards means
`0 of 0` and `0%`. The percentage is `round(done / total * 100)`.

The projects page presents those summaries as a card grid or a list table. Both
views share the same payload; only the layout of the unstarred list changes.
Starred projects sit in a Starred section of cards above that list (hidden when
none are starred). The Starred/rest split lives in `ProjectsView`, which applies
`useOptimistic` to the server starred map so a toggle moves the project between
sections immediately. Star writes reuse the view-mode coalescing loop, keyed by
`projectId`: the latest desired value is persisted sequentially so rapid toggles
never overlap and the last intent always wins. `ProjectStarButton` is
presentational: it receives the current starred value and an `onToggle`
callback, and holds no state of its own. Recents are the latest four accessible
projects the user opened, as chips. Search filters
that payload in the client by title (case-insensitive includes) and does not
re-query the server. The grid/list choice is stored in `UserPreferences.viewMode`.

Zero projects is a distinct empty state from an empty search. `ProjectsView`
renders `ProjectsEmptyState` instead of Recents, Starred, and the grid/list.
The grid/list toggle is hidden from tablet up and left disabled (faded, not
in the tab order) on mobile. The empty state lists the nine templates from `listProjectTemplates()`:
desktop and tablet show them in the dashed box; mobile opens a pushed Templates
screen using the same dialog primitive as `NewProjectDialog` (focus trap, Escape,
inert background, focus restored to View templates). On mobile, a CSS-only demo
board sits below the dashed card (`md:hidden`); `prefers-reduced-motion: reduce`
leaves it assembled with the traveling card in To do. Picking a template and
pressing the CTA opens `NewProjectDialog` with that template's columns as
rename-only inputs (no add, remove, or reorder). The header New project and
mobile + triggers still open it on Blank. Submit sends the edited titles to
`createProject` as `{ title, order }[]` with order `0..n-1`. Blank column names
are rejected on that row with the same title required message as the server.

`Project` has no `updatedAt`; the grid uses the latest `card.updatedAt`, or
`project.createdAt` when there are no cards.

## Access

Mutations walk card → column → project → membership through
`src/lib/ownership.ts` and `accessibleByUser` in `src/lib/membership.ts`. No
session or a broken chain returns `{ error: 'Unauthorized' }`. Pattern details:
`docs/architecture.md`.

`moveCard` adds rules the helpers alone do not cover:

- Ids are validated with `idSchema` **before** any database lookup.
- Source and target columns must both be reachable through membership
  (`getColumnForUser`) and sit on the **same project**. Membership on two
  projects does not allow moving a card between them.
- The occupancy write is `updateMany({ where: { id, columnId: sourceColumnId } })`.
  If the count is not 1, the card was not in that source column (stale client or
  a concurrent move) and the action returns Unauthorized.
- Same source and target is a read-only no-op: no order rewrite.

The client does not send neighbor ids or order numbers.

## Ordering

`order` is still a float so a later intra-column reorder can place a card
without rewriting siblings (`orderBetween` in `src/lib/order.ts`). Today's
`moveCard` always appends: `(max order in the target column) + 1`. Empty
target → `1`.

## Optimistic column moves

Cards move on desktop with HTML5 drag-and-drop (pointer only) plus a keyboard
**Move** menu, and on mobile with a 420ms long press, destination strip, and a
330px snap carousel. `@dnd-kit` is not used. A drop or destination tap commits
`{ cardId, targetColumnId }` and appends to that column. Pure list math lives in
`kanbanItems.ts` / `kanbanPersist.ts` so it can be tested without the React tree.

Progress copy (`N of M cards done` / `N/M done`) uses the same
`projectProgress()` helper as the projects grid.

### Why a queue

Users can move faster than the network. Each drop updates the UI immediately and
enqueues a persist job. Jobs run **one at a time** (`persistChainRef`) so two
in-flight `moveCard` calls cannot race on occupancy.

Without a queue, a second drop would either block the UI or fire with a stale
source column against a board the first request had not finished writing.

### Baseline vs display

`ProjectBoard` keeps two views of the board:

- **Persisted baseline** (`persistedItemsRef`) — last layout acknowledged as
  saved (or the latest server props).
- **Display** (`itemsByColumn`) — what the user sees: baseline plus every job
  still in the queue, applied in order.

The queue (`persistQueueRef`) is FIFO. Enqueue and optimistic display happen
together; the network work trails behind.

### Source column from the baseline

By the time a job reaches the head of the queue, the baseline may have moved
(earlier success) or a columns refresh may have landed. Before calling
`moveCard`, the client builds the payload from the **current** persisted
baseline (`persistPayloadFromBaseline`): occupancy `sourceColumnId` is where
the card sits now, not the snapshot from an older drag. If the card is already
in the target, the client skips the write.

### Failure

A failed job does **not** advance the baseline — that move was never saved.
Display is rebuilt as baseline + **remaining** queued jobs (`reducePersistFinish`).
Later optimistic moves stay visible; the failed one disappears relative to what
the server has. The user sees the generic error string, never a Prisma message.

### Server props after revalidate

`moveCard` revalidates the project path. When fresh `columns` arrive, the effect
sets a new server baseline and sets display to
`applyPendingJobs(newBaseline, queue)`. Pending jobs are not dropped; cards
that appeared on the server merge with in-flight moves instead of wiping them.
A job whose card is already in the target column is a no-op on that list
(no intra-column append).

## Files

```
src/lib/order.ts                    midpoint / append / prepend (stored for later reorder)
src/lib/cardCode.ts                  project-title initials + sequence
src/lib/cardDue.ts                  Today / Yesterday / Tomorrow / late; calendar-day persist
src/lib/labelTones.ts               eight label tones as CSS token classes
src/lib/labels.ts                   defaults, last-label guard, card pill sync
src/lib/projectLabels.ts            read/seed per-project labels
src/lib/board.ts                    carousel width, long-press constants
src/lib/kanbanItems.ts              append move, same-column no-op
src/lib/kanbanPersist.ts            queue reconcile, finish, error shape
src/lib/ownership.ts                column/card/label access chain (membership)
src/lib/validation/moveCard.ts      moveCard card, source, and target ids
src/lib/validation/label.ts         label name/tone and action ids
src/actions/moveCard.ts             occupancy-guarded append to the target column
src/actions/updateLabelField.ts     persist one label name or tone
src/actions/createLabel.ts          append a label (cap 20)
src/actions/deleteLabel.ts          reassign cards, refuse the last remaining
src/lib/projects.ts                 load project with ordered columns/cards; grid/list summaries
src/lib/templates.ts                project template catalog (id, name, ordered column titles)
src/lib/membership.ts               accessibleByUser, last-OWNER guard, owner backfill
src/actions/createProject.ts        create a project, optional column list, optional featured star
src/lib/projectGrid.ts              done/total progress for the grid, list, and board header
src/components/projects/ProjectsView.tsx  grid/list toggle (client); zero-project empty state
src/components/projects/ProjectsEmptyState.tsx  dashed empty box, template picker, mobile Templates screen
src/components/projects/EmptyDemoBoard.tsx  mobile empty-state CSS demo board
src/components/projects/ProjectTemplateRow.tsx  single-select template row
src/components/projects/NewProjectDialog.tsx  create-project modal (name, description, status, featured, rename-only columns)
src/components/projects/ProjectList.tsx   projects table
src/components/projects/ProjectBoard.tsx    persist queue, progress, desktop + mobile boards
src/components/projects/BoardDesktop.tsx  HTML5 DnD and keyboard Move
src/components/projects/BoardMobile.tsx   carousel, long press, destination strip
src/components/projects/BoardColumn.tsx   column chrome
src/components/projects/MemberPopover.tsx  member avatars; popover clamped to the viewport
src/components/projects/memberPopoverPosition.ts  left offset so the popover stays in bounds
src/components/labels/LabelEditor.tsx     reusable editor (inline in new task)
src/components/cards/NewCardDialog.tsx  new-task dialog (540px tablet+, full screen on phone)
src/components/cards/NewCardFields.tsx  shared new-task form body
src/components/cards/BoardCard.tsx      card face (label, code, title, derived footer)
src/components/cards/CardDetailDialog.tsx  card detail (900px two-column tablet+, full screen on phone)
src/components/cards/CardDetailBody.tsx    shared detail body (CSS breakpoints only)
src/components/cards/CardSubtaskList.tsx   subtask add/rename/check/remove and progress
src/components/cards/CardCommentThread.tsx comments list and pinned/in-column composer
src/components/projects/BoardToast.tsx     archive/delete toast on the board
src/lib/cardCounters.ts                 comment count and subtask done/total
src/actions/updateCardField.ts          persist one card title, description, or due date
src/actions/updateCardAssignees.ts      replace card assignees (members only)
src/actions/updateCardLabel.ts          set or clear the card label
src/actions/archiveCard.ts              set archivedAt (occupancy on unset)
src/actions/createSubtask.ts            append a subtask (max order + 1)
src/actions/updateSubtaskField.ts       persist subtask text or done
src/actions/deleteSubtask.ts            delete a subtask
src/actions/createComment.ts            append a comment as the session user
```

## SEE

- `docs/architecture.md`
- `docs/database.md`
- `docs/auth.md` (session and route protection)
