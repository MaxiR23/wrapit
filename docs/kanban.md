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

OWNER and ADMIN can invite another user by username. Invites always create a
`MEMBER` role. `acceptInvitation` claims `PENDING` with a conditional
`updateMany` inside the transaction, then inserts the membership with
`COMMENT` access; a concurrent
reject or a second accept cannot leave a membership on a non-PENDING row. A
mid-flight failure rolls back. Invite, accept, and reject are
membership-based, never `ownerId`. A MEMBER cannot invite.

The owner can transfer the project from Share: that member becomes OWNER
with EDIT access and the previous owner becomes ADMIN, in one transaction
(demote then promote, each `updateMany` count-guarded). Non-owners can leave
from the bottom of Share; the owner’s Leave control is disabled and explains
that a transfer comes first. Leaving and removing both unassign that person
on the project’s cards.

`Column` and `Card` both carry a `Float` `order`. Creates still append with
`(max order in parent) + 1`. The board UI moves cards **between columns only**
and always appends to the target; intra-column reorder is stored for later and
is not exposed in the UI.

`Card.code` is assigned at create time as `{initials(project.title)}-{n}` (for
example `RS-14`), using the same `initials()` helper as avatars (first and last
word). Empty titles fall back to `PR`. `Project.cardCounter` increments atomically
inside the create transaction (`increment: 1`); renaming the project or the card
does not rewrite stored codes. `Card.archivedAt` hides a card from board reads
when it is set. Archive from the card detail writes `archivedAt` and
`archivedById` with a count guard (`archivedAt: null`). The board toast then
links to `/projects/{id}/archived`. Delete from the board hard-removes a live
card (`archivedAt: null`) and cascades comments and subtasks; an EDIT member
cannot hard-delete an archived card by id.

`createProject` also accepts optional `invitees` (usernames). The list is
validated with the project (strings only, username length bounds, at most 20
after dedup); a field error means nothing is created. After the project
transaction commits, each unique username is invited (trimmed, lowercased,
duplicates dropped). Invalid invitees are
collected as `inviteErrors` and do not roll back the project. The new-project
dialog always closes on success and may show a brief notice when some invites
failed; remaining invites happen from Share on the project page.

The project detail page loads ordered columns and visible cards (those with
`archivedAt` unset) server-side via `getProjectForUser`, and project labels via
`getProjectLabelsForUser` (seeding six defaults when the project has none).
Non-members get `notFound()`. A project with no columns still mounts
`ProjectBoard`, so the header and Share stay available; the column area shows
`ColumnsEmptyState`. Cards with a `labelId` render a pill from
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
close the dialog, drop the card from the board, and show a board toast with a
**View archived** link.

Any member can open `/projects/{id}/archived`. The page lists archived tasks
(search on name and label, date range, sort). Restore and permanent delete are
OWNER/ADMIN only; export is available to every member. Restore returns the card
to its stored `columnId` and logs `CARD_RESTORED`. If that column is gone, the
write fails and nothing in the batch is restored. Undo on the restore toast
redeems a server-issued token (`rearchiveArchivedCards` takes only that token).
Restore itself reads `archivedAt` and `archivedById` inside its transaction and
stores them on a `RestoreUndoToken` row keyed by the token, owned by the actor
and the project, single-use, and expiring after five minutes (toast lifetime).
Redeem writes those stored values back; the client never chooses a timestamp or
user id. Expired, already-used, or someone else's token is refused as
Unauthorized with no write. Permanent delete from this
screen is a confirmed batch with no undo.

OWNER and ADMIN can archive a live project from the board header or the
projects grid. That writes `Project.archivedAt` / `archivedById` with a count
guard (`archivedAt: null`). Live list helpers (`accessibleByUser`,
`withBoardAccess`, `administeredByUser`) include `archivedAt: null`, so an
archived project disappears from Projects, recents, stars, My tasks, account
activity, and the board. A member who still has a board bookmark is redirected
to `/archived`; anyone else gets `notFound()`. Accepting an invite to an
archived project is refused. Permanent delete is only on `/archived`, requires
typing the project title exactly, and cascades columns, cards, comments,
history, memberships, invitations, recents, and undo tokens. Restore is batched
and mints a `RestoreUndoToken` with `kind: PROJECT` using the same snapshot
shape as cards; undo calls `rearchiveArchivedProjects({ token })`. The card
rearchive path refuses a `PROJECT` token. A MEMBER's archive, restore, and
delete controls are disabled; the server refuses regardless.

The new-task dialog opens from a
column plus with that column preselected. Its pencil opens the same `LabelEditor`
used for project labels: renaming a label updates every card that points at it;
removing one reassigns those cards to the first remaining label. The last label
cannot be removed. Create is disabled without a title. The card is appended to
the chosen column with the next stored code. Assignees are members of the
project; if none are picked, the creator is assigned. `Card.dueDate` is
optional and can be either a calendar day or a moment; `Card.dueTimeZone` being
empty or set is what tells the two apart. The same `DueDateField` control edits
both on the new task modal and the card detail: a date alone is a day, adding a
time upgrades it to a moment, clearing the time returns it to a day. The client
sends the parts it has (day, optional time, optional IANA zone) and the server
resolves the instant, so no wall-time arithmetic happens in the browser.

Every surface reads due dates through one formatter, `cardDueLabel` in
`src/lib/cardDue.ts`; nothing formats a due date locally. A day gives Today /
Yesterday / Tomorrow against the viewer's local calendar day, not UTC, which is
the rule that has always applied. A moment is converted into the viewer's zone,
gains its time, and names the zone it was set in whenever the two zones read
different clocks at that instant. Overdue comes from the same call: a day turns
late at the viewer's local midnight, a moment when its instant passes.
`ViewerTimeZoneProvider`, mounted in `ProjectBoard`, publishes the viewer's
zone to the card face, the detail, and the activity log. It reads empty on the
server, where consumers fall back to the card's own zone, so nothing mismatches
on hydration.

The page sits in `ProjectsShell` with Projects as the active nav. The topbar
search on this screen filters the board live by title and label
(case-insensitive includes), combined with the header filters; it is not the
projects-list search. Filters (label chips as OR, plus only-mine and
only-overdue) combine with AND across groups. The filter button badge counts
active groups, not selected labels. A summary bar lists what is on and the
visible count while any group is active. Field visibility (label, code,
comments, subtasks, due date, assignees) is a per-user preference on
`UserPreferences` and applies to every card face; filters and search reset on
reload. A failed visibility write rolls the face back to the last persisted
flags and shows the same generic alert as a failed card move. When the combined filter and search match nothing, the board shows a
no-results state instead of empty columns. Filters, visibility, and the member
popover join the shell's single-open panel list with notifications and
account; opening a modal closes them.

A header clock toggles `ProjectBoard` between the column area and a
project-wide activity log (`surface: 'board' | 'log'`). It is not an
`OpenPanel` id; opening the log closes those popovers. `BoardDesktop` and
`BoardMobile` stay mounted and are CSS-hidden so the persist queue, carousel,
and open dialogs are not torn down. The log wins over empty-columns and
no-results. Board filters do not apply. Any member (VIEW+) can read.
`listActivityEvents` loads when the log opens (including re-open), 50 raw
events per page, keyset on `createdAt` + `id`. Consecutive same-type events by
the same actor on the same card collapse on the client before day grouping;
member and project-created events never collapse. Sentences come from
`activityCopy` at display time. The phone uses the same header clock; stacked
row layout is CSS only.

Account `?tab=activity` is the mirror: one actor across every project they
currently belong to. `listMyActivityEvents` re-reads memberships each page so
a project they left cannot leak. The first page loads in the account RSC;
earlier pages use the same request-id append as the board log. Each row names
its project. Assigned-card counts on the project grid ignore archived cards.

The client owns an id list per column; a move persists
`cardId` + `sourceColumnId` + `targetColumnId`. Display order is the id list;
the server appends with `(max order in the target) + 1`.

## Progress on the projects grid

`listProjectSummariesForUser` computes **done / total** from real cards. A card
counts as done when its column title is `Done` (case-insensitive). If the project
has no such column, the last column by `order` is treated as done. No cards means
`0 of 0` and `0%`. The percentage is `round(done / total * 100)`. My tasks
uses the same Done identity via `doneColumnFrom`.

The projects page presents those summaries as a card grid or a list table. Both
views share the same payload; only the layout of the unstarred list changes.
Below `tablet`, list rows collapse to the title; star and archive are a swipe
(right to star, left to archive), reusing the archived-row gesture. Only
`pointerup` can commit; `pointercancel` resets the row without starring or
archiving. Status, Progress, and Team return from `tablet` up, with the icon pair
in the leading column. Starred projects sit in a Starred section of cards above that list
(hidden when none are starred). The Starred/rest split lives in `ProjectsView`, which applies
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

## My tasks

`/tasks` lists every non-archived card assigned to the signed-in user, across
projects they currently belong to, in one query (not one per project).
Completing is `setCardCompleted`: an EDIT occupancy move into that project's
Done column. Uncompleting moves to the inbox (first column that is not titled Done;
when no column is titled Done, the last column by order is treated as Done
and excluded). A project whose only column is Done cannot uncomplete. Filters (topbar search
on title/project/label, project chips, period) combine with AND and never
regroup. Search and chips are not persisted. `?card=` on the project board
opens that card's detail on load and is ignored when the card is missing;
clicking a card still opens detail from board state. Card writes that change
column, assignees, title, description, or due date also
`revalidatePath('/tasks')`.

## Access

Mutations walk card → column → project → membership through
`src/lib/ownership.ts` and `withBoardAccess` in `src/lib/membership.ts`. No
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
**Move** menu, and on mobile with a 420ms long press that lifts the card and
follows the finger across a 330px carousel. Cards use `touch-pan-y` from
pointer-down so a hold-then-drag is not claimed as a carousel pan (`touch-action`
is fixed for the gesture at pointer-down; toggling `touch-none` after the lift
is too late). The rail stays freely scrollable outside the cards: swipe the
column header, empty column body, or padding, or tap the dots. A vertical
swipe on a card still scrolls the list. While lifted, snap is off and the
rail auto-scrolls only inside a 40px edge band at 0.22px/ms (about 1.5s per
column). Pointerup always clears the lift. Only the column under the pointer
at release counts: a drop there on another column commits
`{ cardId, targetColumnId }` and appends; releasing outside every column
moves nothing. Hover highlight follows the finger and does not decide the
drop. `pointercancel` clears the lift and drops nothing. `@dnd-kit` is not
used. Pure list math lives in `kanbanItems.ts` / `kanbanPersist.ts` so it can
be tested without the React tree.

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
src/lib/cardDue.ts                  Today / Yesterday / Tomorrow / late; calendar-day persist; dueDeltaDays
src/lib/labelTones.ts               eight label tones as CSS token classes
src/lib/labels.ts                   defaults, last-label guard, card pill sync
src/lib/activity.ts                 typed payloads, recordActivityEvent, listActivityForProject, listActivityForActor
src/lib/activityCopy.ts             English activity sentences and chrome copy
src/lib/activityDisplay.ts          sentence, clock, day groups, collapse
src/lib/accountActivity.ts          account Activity tab projects + assigned counts
src/lib/validation/activity.ts      listActivityEvents projectId and optional cursor; listMyActivityEvents cursor
src/lib/projectLabels.ts            read/seed per-project labels
src/lib/board.ts                    carousel width, long-press constants
src/lib/boardView.ts                board filters, search match, visibility defaults, summary
src/lib/kanbanItems.ts              append move, same-column no-op
src/lib/kanbanPersist.ts            queue reconcile, finish, error shape
src/lib/ownership.ts                column/card/label access chain (membership)
src/lib/validation/moveCard.ts      moveCard card, source, and target ids
src/lib/validation/completeCard.ts  setCardCompleted cardId + completed
src/lib/myTasks.ts                  assigned cards across projects, due groups, AND filters, open count
src/actions/setCardCompleted.ts     occupancy move to Done or inbox; revalidates /tasks
src/lib/validation/label.ts         label name/tone and action ids
src/actions/moveCard.ts             occupancy-guarded append to the target column
src/actions/updateLabelField.ts     persist one label name or tone
src/actions/createLabel.ts          append a label (cap 20)
src/actions/deleteLabel.ts          reassign cards, refuse the last remaining
src/lib/validation/boardVisibility.ts  six board-face visibility flags
src/actions/updateBoardVisibility.ts persist board field visibility on UserPreferences
src/lib/projects.ts                 load project with ordered columns/cards; grid/list summaries
src/lib/templates.ts                project template catalog (id, name, ordered column titles)
src/lib/membership.ts               accessibleByUser, withBoardAccess, administeredByUser, archived counterparts, last-OWNER guard, unassign, owner backfill
src/lib/boardAccess.ts              access labels, canEdit/canComment/canAdminister, ownership display, public board URL
src/actions/createProject.ts        create a project, optional column list, optional featured star
src/lib/projectGrid.ts              done/total progress; doneColumnFrom / inboxColumnFrom
src/components/projects/ProjectsView.tsx  grid/list toggle (client); zero-project empty state
src/components/projects/ProjectsEmptyState.tsx  dashed empty box, template picker, mobile Templates screen
src/components/projects/EmptyDemoBoard.tsx  mobile empty-state CSS demo board
src/components/projects/ProjectTemplateRow.tsx  single-select template row
src/components/projects/NewProjectDialog.tsx  create-project modal (name, description, status, featured, rename-only columns)
src/components/projects/ProjectList.tsx   projects table
src/components/projects/ProjectBoard.tsx    persist queue, progress, desktop + mobile boards, filters, activity log surface
src/components/projects/ColumnsEmptyState.tsx  empty column area when the project has no columns
src/components/projects/BoardHeader.tsx   title, progress, members, Share, filters, visibility, Archived, activity clock, summary
src/components/projects/BoardActivityLog.tsx  day-grouped activity rows, empty copy, load earlier
src/components/account/AccountActivity.tsx    account Activity tab: project cards + personal timeline
src/components/projects/ShareModal.tsx    share dialog (sheet below tablet, 520px from tablet up)
src/components/projects/ShareModalBody.tsx  invite, with-access list, public-link row, leave
src/components/projects/ShareMemberRow.tsx  permission menu, transfer, coalesced access/remove
src/components/projects/ShareConfirm.tsx  inline confirm (transfer and leave)
src/components/projects/BoardFiltersPopover.tsx  label / only-mine / only-overdue popover and sheet
src/components/projects/BoardVisibilityPopover.tsx  six field toggles, persisted per user
src/components/projects/BoardFilterSummary.tsx  active-filter copy and Clear
src/components/projects/BoardNoResults.tsx  empty combined filter+search state
src/components/projects/BoardDesktop.tsx  HTML5 DnD and keyboard Move
src/components/projects/BoardMobile.tsx   carousel, long press, finger-following drag
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
src/components/projects/BoardToast.tsx     archive/delete toast; View archived link; restore undo
src/lib/cardCounters.ts                 comment count and subtask done/total
src/components/cards/DueDateField.tsx      shared date + optional time control
src/components/tasks/MyTasksView.tsx    assigned-task list, filters, groups, empty states
src/components/tasks/MyTaskRow.tsx      complete circle vs open-detail split
src/components/tasks/MyTasksDetail.tsx  right panel from tablet; bottom sheet on phone
src/components/tasks/NewTaskPopover.tsx two-step create (project, then title + due)
src/components/archived/ArchivedView.tsx  archived tasks or projects: filters, selection, restore, export, delete
src/components/archived/ArchivedRow.tsx   phone swipe/long-press and wide-table row
src/components/archived/ArchivedDetail.tsx  read-only archived task or project panel
src/components/archived/ArchivedEmptyState.tsx  none-archived and no-results empty states
src/components/archived/ArchivedDeleteDialog.tsx  permanent-delete confirm for tasks
src/components/archived/ArchivedDeleteProjectDialog.tsx  typed-title permanent-delete confirm
src/components/archived/ArchivedExportDialog.tsx  CSV or JSON at export time
src/lib/archived.ts                     filter, sort, slice, copy helpers
src/lib/swipe.ts                        shared row-swipe thresholds and pointer gesture
src/lib/archivedQuery.ts                load archived cards for a member
src/lib/archivedProjectsQuery.ts        load archived projects for a member
src/lib/archivedCopy.ts                 English archived-screen copy
src/lib/archivedExport.ts               client-side CSV/JSON from loaded rows
src/lib/archivedScope.ts                tasks and projects scope adapters
src/lib/restoreUndo.ts                  undo-token id, ttl, expired-row cleanup
src/lib/validation/archived.ts          restore, rearchive, delete, archive-project schemas
src/app/projects/[projectId]/archived/page.tsx  archived tasks route (member only)
src/app/archived/page.tsx               archived projects route
src/components/projects/ArchiveProjectDialog.tsx  confirm before archiving a live project
src/components/projects/ViewerTimeZoneProvider.tsx  the viewer's IANA zone
src/actions/updateCardField.ts          persist one card title, description, or due date
src/actions/updateCardAssignees.ts      replace card assignees (members only)
src/actions/updateCardLabel.ts          set or clear the card label
src/actions/archiveCard.ts              set archivedAt and archivedById (occupancy on unset)
src/actions/restoreArchivedCards.ts     restore to stored column; mint undo token; CARD_RESTORED
src/actions/rearchiveArchivedCards.ts   redeem restore undo token; original archive metadata
src/actions/deleteArchivedCards.ts      permanently delete archived cards
src/actions/archiveProject.ts           occupancy on live + OWNER/ADMIN membership
src/actions/restoreArchivedProjects.ts  occupancy on archived + OWNER/ADMIN; mint PROJECT undo
src/actions/rearchiveArchivedProjects.ts redeem project restore undo; OWNER/ADMIN on the write
src/actions/deleteArchivedProject.ts    occupancy on archived + typed title + OWNER/ADMIN
src/actions/createSubtask.ts            append a subtask (max order + 1)
src/actions/updateSubtaskField.ts       persist subtask text or done
src/actions/deleteSubtask.ts            delete a subtask
src/actions/createComment.ts            append a comment as the session user
src/actions/listActivityEvents.ts       member-only project activity page (VIEW+)
src/actions/listMyActivityEvents.ts      session user's events across current memberships
```

## SEE

- `docs/architecture.md`
- `docs/database.md`
- `docs/auth.md` (session and route protection)
