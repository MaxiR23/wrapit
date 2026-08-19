# Kanban

How projects, columns and cards work: ownership, float ordering, and optimistic
drag-and-drop. App layering and the general file map: `docs/architecture.md`.
Schema and Prisma setup: `docs/database.md`.

## Domain

Hierarchy: **Project → Column → Card**. A project has one owner (`User`). Deleting a
project or column cascades to its children, so mutations do not need orphan
cleanup.

`createProject` accepts an optional ordered column list (`title` + client
`order`). It validates titles (trimmed, non-empty), requires 1–8 columns, then
sorts by the provided order and reassigns `0..n-1` so client order values are
never trusted. When `columns` is omitted, it seeds the **blank** template
(**To do**, **In progress**, **Done**) from `src/lib/templates.ts`. Columns are
created in the same transaction as the project. A create-time `featured` flag
stars the board in that same transaction by upserting the owner's `Membership`
with `starred: true` (the same OWNER upsert `setProjectStarred` uses when the
owner has no membership row).

`Column` and `Card` both carry a `Float` `order`. Creates still append with
`(max order in parent) + 1`. Only **cards** are reordered in the UI today;
columns keep creation order.

The project detail page loads ordered columns and cards server-side via
`getProjectForUser`. Non-owners get `notFound()`. The client receives card id lists
per column for DnD — not the float values. Display order is the id list;
persistence recomputes floats on the server from neighbor ids.

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
callback, and holds no state of its own. Recents are the latest four owned
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

## Ownership

Mutations walk card → column → project → user through `src/lib/ownership.ts`. No
session or a broken chain returns `{ error: 'Unauthorized' }`. Pattern details:
`docs/architecture.md`.

`moveCard` adds rules the helpers alone do not cover:

- The target column must sit on the **same project** as the card. Owning two projects
  does not allow moving a card between them.
- Optional `beforeCardId` / `afterCardId` must exist in the **target** column
  (and must not be the moving card).
- The client sends **neighbor ids**, never order numbers. The server reads those
  rows and computes placement. Trusting a client float would let a request plant
  a card anywhere in the sort key space.

## Ordering

`orderBetween(before, after)` in `src/lib/order.ts` places a card without
rewriting siblings:

- no neighbors → `1` (empty column)
- only before → `before + 1` (append)
- only after → `after / 2` (prepend; must stay strictly between `0` and `after`)
- both → midpoint `(before + after) / 2`

It returns `null` when no distinct finite value fits: equal neighbors, a
collapsed float gap, prepend underflow, or append past safe integer range.

`moveCard` calls `orderBetween` first. A non-null result is a single update of
`columnId` + `order`. On `null`, `renumberColumnInserting` loads the column,
inserts the card at the neighbor-derived index, and rewrites every card to
`1..n` in a transaction.

**Why floats plus renumber:** most moves stay one UPDATE. Renumber is the safety
valve when precision runs out or historical duplicates leave no gap — not the
happy path.

## Optimistic drag-and-drop

Cards move with `@dnd-kit` in `ProjectKanban`. A drop commits a semantic position
`{ cardId, targetColumnId, beforeCardId, afterCardId }`, not indices. Pure list
math lives in `kanbanItems.ts` / `kanbanPersist.ts` so it can be tested without
the React tree.

### Why a queue

Users can drag faster than the network. Each drop updates the UI immediately and
enqueues a persist job. Jobs run **one at a time** (`persistChainRef`) so two
in-flight `moveCard` calls cannot race on neighbors or overwrite each other.

Without a queue, a second drop would either block the UI or fire with stale
neighbors against a board the first request had not finished writing.

### Baseline vs display

`ProjectKanban` keeps two views of the board:

- **Persisted baseline** (`persistedItemsRef`) — last layout acknowledged as
  saved (or the latest server props).
- **Display** (`itemsByColumn`) — what the user sees: baseline plus every job
  still in the queue, applied in order.

The queue (`persistQueueRef`) is FIFO. Enqueue and optimistic display happen
together; the network work trails behind.

### Reconcile before the action

By the time a job reaches the head of the queue, the baseline may have moved
(earlier success) or a neighbor id from drag-time may no longer sit where the
user thought. Before calling `moveCard`, the client:

1. Applies the job onto the **current** persisted baseline (`reconcilePersistJob`).
2. Recomputes neighbors from that reconciled list (`persistPayloadFromReconciled`).
3. Sends that payload to the server.

So the server always sees neighbors that match the board the client believes is
already saved, not the snapshot from an older drag.

### Failure

A failed job does **not** advance the baseline — that move was never saved.
Display is rebuilt as baseline + **remaining** queued jobs (`reducePersistFinish`).
Later optimistic moves stay visible; the failed one disappears relative to what
the server has. The user sees the generic error string, never a Prisma message.

### Server props after revalidate

`moveCard` revalidates the project path. When fresh `columns` arrive, the effect
sets a new server baseline and sets display to
`applyPendingJobs(newBaseline, queue)`. Pending jobs are not dropped; cards
created through dialogs on the server merge with in-flight drags instead of
wiping them.

## Files

```
src/lib/order.ts                    midpoint / append / prepend
src/lib/kanbanItems.ts              place, neighbors, drag transitions
src/lib/kanbanPersist.ts            queue reconcile, finish, error shape
src/lib/ownership.ts                column/card ownership chain
src/lib/validation/moveCard.ts      moveCard input rules
src/actions/moveCard.ts             persist columnId + order (or renumber)
src/lib/projects.ts                 load project with ordered columns/cards; grid/list summaries
src/lib/templates.ts                project template catalog (id, name, ordered column titles)
src/lib/membership.ts               upsert owner Membership.starred (OWNER row)
src/actions/createProject.ts        create a project, optional column list, optional featured star
src/lib/projectGrid.ts              done/total progress for the projects grid and list
src/components/projects/ProjectsView.tsx  grid/list toggle (client); zero-project empty state
src/components/projects/ProjectsEmptyState.tsx  dashed empty box, template picker, mobile Templates screen
src/components/projects/EmptyDemoBoard.tsx  mobile empty-state CSS demo board
src/components/projects/ProjectTemplateRow.tsx  single-select template row
src/components/projects/NewProjectDialog.tsx  create-project modal (name, description, status, featured, rename-only columns)
src/components/projects/ProjectList.tsx   projects table
src/components/projects/ProjectKanban.tsx   DnD context, queue, commit
src/components/projects/KanbanColumn.tsx  droppable column
src/components/cards/SortableCard.tsx   draggable card
```

## SEE

- `docs/architecture.md`
- `docs/database.md`
- `docs/auth.md` (session and route protection)
