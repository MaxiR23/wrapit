# Authentication

How authentication is set up in this repo.

## Stack

[Better Auth](https://www.better-auth.com/) with the Prisma adapter, on the
same PostgreSQL database as the rest of the app.

Only email and password is enabled. Sign up, sign in, sign out and route
protection all work. There are no social providers.

## Environment variables

Both live in `.env` (never committed) and are listed in `.env.example`:

- `BETTER_AUTH_SECRET` — signs sessions and tokens. Generate one with
  `openssl rand -base64 32`. Changing it invalidates every existing session.
- `BETTER_AUTH_URL` — the base URL of the app, `http://localhost:3000` in
  development. Without it Better Auth derives the origin from the incoming
  request, which makes callbacks and redirects unreliable.

## Files

    src/proxy.ts                        route protection, runs before every request
    src/lib/routes.ts                   which routes are public; BOARDS_PATH, boardPath
    src/lib/auth.ts                     the Better Auth instance (server)
    src/lib/authClient.ts               the Better Auth client (browser)
    src/lib/boards.ts                   list boards and load one board for the current user
    src/lib/validation/fieldErrors.ts   first error per field, shared by the validators
    src/lib/validation/signUp.ts        sign up field rules, shared by both
    src/lib/validation/signIn.ts        sign in field rules
    src/lib/validation/board.ts         board title rules
    src/lib/validation/column.ts        column title rules
    src/actions/createBoard.ts          create a board for the signed-in user
    src/actions/createColumn.ts         create a column on a board the user owns
    src/actions/deleteColumn.ts         delete a column from a board the user owns
    src/app/api/auth/[...all]/route.ts  catch-all handler for /api/auth/*
    src/components/auth/SignUpForm.tsx  the sign up form
    src/components/auth/SignInForm.tsx  the sign in form
    src/components/auth/AuthNav.tsx     the nav that hosts the sign out action
    src/components/boards/              boards list, board detail columns, empty states, dialogs
    src/components/ui/                  shadcn/ui primitives used by the forms
    src/app/page.tsx                    / redirects by session to /boards or /sign-in
    src/app/boards/page.tsx             lists the current user's boards
    src/app/boards/[boardId]/page.tsx   board detail with columns (owner only; else 404)
    src/app/sign-up/page.tsx            the /sign-up page
    src/app/sign-in/page.tsx            the /sign-in page
    src/app/globals.css                 theme tokens (Neutral base color)

`src/lib/auth.ts` wires Better Auth to the shared Prisma client from
`src/lib/prisma.ts` and enables email and password. The `nextCookies()` plugin
goes last in the plugin list; it lets Better Auth set cookies from server
actions.

The route handler mounts every Better Auth endpoint under `/api/auth/`, for
example `/api/auth/sign-up/email` and `/api/auth/get-session`.

`src/lib/authClient.ts` exports `authClient`, created with `createAuthClient()`
from `better-auth/react`. It takes no `baseURL`: the client defaults to the
current origin, which is where the API routes live.

## Sign up

`/sign-up` renders `SignUpForm`, a client component with name, email and
password. It uses react-hook-form with `zodResolver(signUpSchema)` so invalid
input never reaches the network, then calls `authClient.signUp.email(...)`. On
success Better Auth sets the session cookie and the form redirects to `/boards`.

The rules live in `src/lib/validation/signUp.ts` as a single zod schema
(`signUpSchema`). The form and `validateSignUp` both use that schema; do not
duplicate the rules. That module also exports `MIN_PASSWORD_LENGTH`, which
`src/lib/auth.ts` passes to `emailAndPassword.minPasswordLength`. It matches
Better Auth's own default of 8; setting it explicitly keeps the browser and the
server from drifting apart.

The client returns `{ data, error }` rather than throwing. Only recognized
codes get a specific message: `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` (the 422
Better Auth sends for a taken email) becomes a message on the email field. Every
other failure shows a fixed generic message, and `error.message` is deliberately
never rendered — an unexpected error can carry server internals such as a
database host or a constraint name. Add a code to the recognized list in
`SignUpForm.tsx` when it deserves its own wording.

One gap worth knowing: Better Auth's sign up schema rejects a **missing** name
but accepts an **empty string**, so a direct POST to `/api/auth/sign-up/email`
can still create a user with `name: ""`. The non-empty check is currently only
in `signUpSchema` on the client (form + `validateSignUp`). Closing it
server-side would need a `databaseHooks` guard in `src/lib/auth.ts`.

## Sign in

`/sign-in` renders `SignInForm`, a client component with email and password. It
follows the same shape as sign up: react-hook-form with
`zodResolver(signInSchema)` so invalid input never reaches the network, then
`authClient.signIn.email(...)`. On success the form redirects to `/boards` and calls
`router.refresh()` so the nav re-reads the session.

The rules live in `src/lib/validation/signIn.ts` as `signInSchema`. The form and
`validateSignIn` both use that schema. They deliberately do **not** reuse
`MIN_PASSWORD_LENGTH`: on sign in only presence is checked. A length rule would
buy nothing (the server decides) and would lock out an account whose password
predates a change to the minimum.

### Not revealing whether an email is registered

A failed sign in must never tell an attacker which emails have accounts.
Better Auth is already built that way: an unknown email and a wrong password
both come back as `401` with the code `INVALID_EMAIL_OR_PASSWORD`, and it hashes
the submitted password even when the user does not exist so the two paths take
similar time.

`SignInForm` holds up its end:

- Every `401`, and every code in `CREDENTIALS_ERROR_CODES`
  (`INVALID_EMAIL_OR_PASSWORD`, `USER_NOT_FOUND`, `INVALID_PASSWORD`), renders
  the one message `Invalid email or password.` The extra codes are listed so
  that a future configuration which does distinguish them still cannot be used
  to probe for registered emails.
- Anything else renders the same generic message as sign up, and `error.message`
  is never rendered.
- A rejected credential is always a **form-level** error, never a field error.
  Attaching it to the email input would itself suggest the email was the problem.

`tests/components/auth/SignInForm.test.tsx` asserts the wrong-password message
and the unknown-email message are the same string, so adding a branch that leaks
existence breaks the build.

## Sign out

`AuthNav` is a client component mounted in `src/app/layout.tsx`. It reads
`authClient.useSession()` and shows either a **Sign out** button or links to
`/sign-in` and `/sign-up`. While the session is still loading it renders an
empty nav, so a signed in user never sees the signed out links flash.

Sign out calls `authClient.signOut()`, which deletes the `Session` row and
clears the cookie, then redirects to `/sign-in` and calls `router.refresh()`.
A failed sign out shows a fixed message and does not navigate; as everywhere
else, the server message is not rendered.

The nav is not route-aware; it only reflects the session. Protection lives in
`src/proxy.ts`.

## Route protection

`src/proxy.ts` runs before every matched request and decides whether it may
continue. Next 16 calls this file convention **proxy**; it was named
`middleware` before and the old name is deprecated, so a snippet from the Better
Auth docs that says `middleware.ts` belongs in `src/proxy.ts` here.

It sits beside `src/app/`, not inside it. Next only looks for the convention at
the project root or at `src/`, so a proxy nested any deeper is silently ignored
and every route becomes public. `pnpm build` listing a `Proxy (Middleware)` entry
is the proof that it is wired up.

Two rules:

- No session on a private route redirects to `/sign-in`.
- A session on `/sign-in` or `/sign-up` redirects to `/boards`.

`/` itself is public but only redirects: a real session goes to `/boards`,
otherwise to `/sign-in`. Post-login destinations are consistent on
`BOARDS_PATH` (`/boards`) — proxy, sign-in/up forms, and the home page.

Everything else is served untouched.

### Public vs private

`src/lib/routes.ts` holds the definitions. Public means reachable without a
session:

    /            home
    /sign-in     the sign in page
    /sign-up     the sign up page
    /api/auth/*  the Better Auth endpoints

Anything else is private, so a new page is protected the moment it exists and
opening one up is a deliberate edit to that file. `/api/auth/*` must stay public
or signing in would be impossible: the request that creates the session would
itself be redirected. Trailing slashes are normalized, and a prefix match only
counts on a segment boundary, so `/api/authorize` is private.

The `config.matcher` in `src/proxy.ts` skips Next internals and static files. The
auth pages are matched on purpose — that is what makes the second rule fire.

### The check is optimistic

The proxy only looks for the session cookie with `getSessionCookie` from
`better-auth/cookies`. It does not validate it against the database, which keeps
it cheap enough to run on every request. That means a forged or expired cookie
gets past the proxy.

This is the approach Better Auth recommends, and it is safe only because the
proxy is a redirect, not the authorization check. Anything that reads or writes
user data must still load the real session on the server with
`auth.api.getSession({ headers: await headers() })` and act on it. Treat the
proxy as navigation, not as a guard.

There is no `?redirect=` parameter yet: a visitor bounced from a private route
lands on `/sign-in` and then on `/boards`, not on the page they asked for.

Server actions such as `createBoard` always call
`auth.api.getSession({ headers: await headers() })` and scope writes to
`session.user.id`. The proxy cookie check alone is not enough.

## Database schema

Better Auth owns four models in `prisma/schema.prisma`:

- `User` — identity and profile. It already existed for `Board` ownership and
  was reconciled with what Better Auth expects.
- `Session` — one row per active session, looked up by a unique `token`.
- `Account` — one row per login method for a user. Email and password sign up
  creates a row with `providerId` set to `"credential"`.
- `Verification` — short-lived tokens, for example email verification.

Passwords are **not** stored on `User`. Better Auth hashes them with scrypt and
stores them in `Account.password`, which is why that column is optional: a
social account has no password. This also means one user can have several
`Account` rows, one per login method.

Two things differ from what `auth generate` emits, on purpose:

- No `@@map`. The generator maps to lowercase table names. The adapter talks to
  Prisma models rather than tables, so the mapping is irrelevant to Better Auth,
  and leaving it out keeps table names in PascalCase like `Board` and `Card`.
- `@default(cuid())` on the ids. Better Auth always supplies an id, so the
  default only applies to rows created outside of it. It keeps these models
  consistent with the rest of the schema.

`Session` and `Account` cascade on user deletion.

## Regenerating the schema

After changing the Better Auth config (adding a plugin, for example), the CLI
prints the models the new config needs:

    pnpm dlx auth@latest generate --config src/lib/auth.ts --output /tmp/auth.prisma

Reconcile that output into `prisma/schema.prisma` by hand, keeping the two
deviations above, then run `pnpm db:migrate` and `pnpm db:generate`.

## Testing

Tests never touch the database. `tests/helpers/prismaFake.ts` is an in-memory
stand-in for the Prisma delegates the adapter uses; any method or `where`
operator it does not implement throws, so a test cannot silently fall through to
a real connection.

The forms and the nav are tested against a mocked `authClient`, so their tests
cover their own behavior (validation, error mapping, redirect) without a server:
`tests/components/auth/SignUpForm.test.tsx`,
`tests/components/auth/SignInForm.test.tsx` and
`tests/components/auth/AuthNav.test.tsx`.

The server-side rules are covered in `tests/lib/auth.test.ts` (sign up, sign in,
wrong password, unknown email) and `tests/api/auth/route.test.ts`, which drives
the real route handler with raw `Request` objects and replays the session cookie
to prove that sign out actually removes the `Session` row.

Route protection is covered in `tests/lib/routes.test.ts` (which paths are
public) and `tests/proxy.test.ts`, which calls the proxy with a `NextRequest`
and asserts where each response redirects. Because the check is optimistic, the
test only has to set or omit the `better-auth.session_token` cookie; the value
is never validated.

## SEE

- Better Auth docs: https://www.better-auth.com/docs
- Prisma guide: https://www.prisma.io/docs/guides/authentication/better-auth/nextjs
- `docs/database.md`
