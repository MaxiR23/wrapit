# Authentication

How authentication is set up in this repo.

## Stack

[Better Auth](https://www.better-auth.com/) with the Prisma adapter, on the
same PostgreSQL database as the rest of the app.

Only email and password is enabled. Sign up, sign in and sign out all work.
There is no route protection yet and no social providers.

## Environment variables

Both live in `.env` (never committed) and are listed in `.env.example`:

- `BETTER_AUTH_SECRET` — signs sessions and tokens. Generate one with
  `openssl rand -base64 32`. Changing it invalidates every existing session.
- `BETTER_AUTH_URL` — the base URL of the app, `http://localhost:3000` in
  development. Without it Better Auth derives the origin from the incoming
  request, which makes callbacks and redirects unreliable.

## Files

    app/lib/auth.ts                    the Better Auth instance (server)
    app/lib/authClient.ts              the Better Auth client (browser)
    app/lib/validation/fieldErrors.ts  first error per field, shared by the validators
    app/lib/validation/signUp.ts       sign up field rules, shared by both
    app/lib/validation/signIn.ts       sign in field rules
    app/api/auth/[...all]/route.ts     catch-all handler for /api/auth/*
    app/components/SignUpForm.tsx      the sign up form
    app/components/SignInForm.tsx      the sign in form
    app/components/AuthNav.tsx         the nav that hosts the sign out action
    app/sign-up/page.tsx               the /sign-up page
    app/sign-in/page.tsx               the /sign-in page

`app/lib/auth.ts` wires Better Auth to the shared Prisma client from
`app/lib/prisma.ts` and enables email and password. The `nextCookies()` plugin
goes last in the plugin list; it lets Better Auth set cookies from server
actions.

The route handler mounts every Better Auth endpoint under `/api/auth/`, for
example `/api/auth/sign-up/email` and `/api/auth/get-session`.

`app/lib/authClient.ts` exports `authClient`, created with `createAuthClient()`
from `better-auth/react`. It takes no `baseURL`: the client defaults to the
current origin, which is where the API routes live.

## Sign up

`/sign-up` renders `SignUpForm`, a client component with name, email and
password. It validates with `validateSignUp` before calling
`authClient.signUp.email(...)`, so invalid input never reaches the network. On
success Better Auth sets the session cookie and the form redirects to `/`.

The rules live in `app/lib/validation/signUp.ts` as a zod schema. That module
also exports `MIN_PASSWORD_LENGTH`, which `app/lib/auth.ts` passes to
`emailAndPassword.minPasswordLength`. It matches Better Auth's own default of 8;
setting it explicitly keeps the browser and the server from drifting apart.

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
in `validateSignUp`, on the client. Closing it server-side would need a
`databaseHooks` guard in `app/lib/auth.ts`.

## Sign in

`/sign-in` renders `SignInForm`, a client component with email and password. It
follows the same shape as sign up: `validateSignIn` runs first so invalid input
never reaches the network, then `authClient.signIn.email(...)`. On success the
form redirects to `/` and calls `router.refresh()` so the nav re-reads the
session.

The rules live in `app/lib/validation/signIn.ts`. They deliberately do **not**
reuse `MIN_PASSWORD_LENGTH`: on sign in only presence is checked. A length rule
would buy nothing (the server decides) and would lock out an account whose
password predates a change to the minimum.

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

`tests/components/SignInForm.test.tsx` asserts the wrong-password message and
the unknown-email message are the same string, so adding a branch that leaks
existence breaks the build.

## Sign out

`AuthNav` is a client component mounted in `app/layout.tsx`. It reads
`authClient.useSession()` and shows either a **Sign out** button or links to
`/sign-in` and `/sign-up`. While the session is still loading it renders an
empty nav, so a signed in user never sees the signed out links flash.

Sign out calls `authClient.signOut()`, which deletes the `Session` row and
clears the cookie, then redirects to `/sign-in` and calls `router.refresh()`.
A failed sign out shows a fixed message and does not navigate; as everywhere
else, the server message is not rendered.

The nav is not route-aware and does not protect anything. Route protection is
still to be built.

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

    pnpm dlx auth@latest generate --config app/lib/auth.ts --output /tmp/auth.prisma

Reconcile that output into `prisma/schema.prisma` by hand, keeping the two
deviations above, then run `pnpm db:migrate` and `pnpm db:generate`.

## Testing

Tests never touch the database. `tests/helpers/prismaFake.ts` is an in-memory
stand-in for the Prisma delegates the adapter uses; any method or `where`
operator it does not implement throws, so a test cannot silently fall through to
a real connection.

The forms and the nav are tested against a mocked `authClient`, so their tests
cover their own behavior (validation, error mapping, redirect) without a server:
`tests/components/SignUpForm.test.tsx`, `tests/components/SignInForm.test.tsx`
and `tests/components/AuthNav.test.tsx`.

The server-side rules are covered in `tests/lib/auth.test.ts` (sign up, sign in,
wrong password, unknown email) and `tests/api/auth/route.test.ts`, which drives
the real route handler with raw `Request` objects and replays the session cookie
to prove that sign out actually removes the `Session` row.

## SEE

- Better Auth docs: https://www.better-auth.com/docs
- Prisma guide: https://www.prisma.io/docs/guides/authentication/better-auth/nextjs
- `docs/database.md`
