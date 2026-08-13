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
- `src/components/` — React UI grouped by domain (`auth/`, `boards/`, `cards/`).
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
that scopes Prisma to that user — for example `listBoardsForUser` /
`getBoardForUser` in `src/lib/boards.ts`. Missing or foreign boards return
`null`; the page turns that into `notFound()`. The client never talks to Prisma
for board data.

**Writes** go through server actions under `src/actions/`. Each action checks
the real session, validates input, checks ownership, then mutates. Failures that
should not leak internals return a fixed generic message (`GENERIC_ERROR_MESSAGE`
in `src/lib/messages.ts`).

**Auth in the browser** is the exception: sign up, sign in and sign out call
`authClient` against `/api/auth/*`. Everything else that changes domain data uses
an action.

**Route protection** in `src/proxy.ts` is navigation, not authorization. It only
looks for a session cookie and redirects. Anything that reads or writes user
data must still load the real session on the server. See `docs/auth.md`.

## Ownership

Every board belongs to one user (`ownerId`). Columns belong to boards; cards
belong to columns. Mutations walk that chain — card → column → board → user —
so a forged id for someone else's card cannot succeed.

`src/lib/ownership.ts` centralizes the lookups (`getColumnForUser`,
`getCardForUser`). Actions return `{ error: 'Unauthorized' }` when any link is
missing or not owned. That is deliberate: pages hide existence with `notFound()`;
mutations refuse without confirming whether the row exists for another user.

Extra rules for moving cards (same board, neighbors in the target column) live
in `docs/kanban.md`.

## Where things live

- **Validation** — zod schemas in `src/lib/validation/`, shared by forms and
  actions so browser and server cannot drift. `fieldErrors.ts` turns a zod
  failure into the first error per field.
- **Domain reads** — `src/lib/boards.ts` and ownership helpers, not pages.
- **Kanban DnD math** — pure helpers in `src/lib/` (`order.ts`, `kanbanItems.ts`,
  `kanbanPersist.ts`) so they can be tested without React. Behavior:
  `docs/kanban.md`.
- **Tests** — under `tests/`, mirroring `src/`. Conventions: `docs/testing.md`.

## File map

    src/proxy.ts                        route protection (cookie check only)
    src/lib/routes.ts                   public routes; BOARDS_PATH, boardPath
    src/lib/auth.ts                     Better Auth instance (server)
    src/lib/authClient.ts               Better Auth client (browser)
    src/lib/email.ts                    Resend helper (password-reset email)
    src/lib/prisma.ts                   shared Prisma client
    src/lib/boards.ts                   list/load boards (with columns and cards)
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
    src/lib/validation/board.ts         board title rules
    src/lib/validation/column.ts        column title rules
    src/lib/validation/card.ts          card title and optional description
    src/lib/validation/moveCard.ts      moveCard id and neighbor rules
    src/actions/createBoard.ts          create a board for the signed-in user
    src/actions/createColumn.ts         create a column on an owned board
    src/actions/deleteColumn.ts         delete a column from an owned board
    src/actions/createCard.ts           create a card on an owned column
    src/actions/updateCard.ts           update an owned card
    src/actions/deleteCard.ts           delete an owned card
    src/actions/moveCard.ts             move/reorder a card (columnId + order)
    src/app/api/auth/[...all]/route.ts  Better Auth catch-all
    src/app/page.tsx                    / landing hero; session redirects to /boards
    src/app/boards/page.tsx             boards list
    src/app/boards/[boardId]/page.tsx   board detail (owner only; else 404)
    src/app/(auth)/layout.tsx           auth split: two-panel, stacked, mobile
    src/app/(auth)/sign-up/page.tsx     /sign-up
    src/app/(auth)/sign-in/page.tsx     /sign-in
    src/app/(auth)/forgot-password/page.tsx  /forgot-password
    src/app/(auth)/reset-password/page.tsx   /reset-password
    src/app/globals.css                 theme tokens (Neutral base)
    src/components/auth/                sign up, sign in, password reset, landing, AuthNav
    src/components/boards/              boards list, BoardKanban, column dialogs
    src/components/cards/               sortable cards, card dialogs
    src/components/ui/                  shadcn/ui primitives

## SEE

- `README.md` (Layout, Commands)
- `AGENTS.md` (Structure)
- `docs/auth.md`
- `docs/database.md`
- `docs/kanban.md`
- `docs/testing.md`
