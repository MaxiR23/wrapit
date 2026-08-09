# Authentication

How authentication is set up in this repo.

## Stack

[Better Auth](https://www.better-auth.com/) with the Prisma adapter, on the
same PostgreSQL database as the rest of the app.

Only email and password is enabled. There is a sign up page; there is no sign in
or sign out UI yet, no route protection, and no social providers.

## Environment variables

Both live in `.env` (never committed) and are listed in `.env.example`:

- `BETTER_AUTH_SECRET` — signs sessions and tokens. Generate one with
  `openssl rand -base64 32`. Changing it invalidates every existing session.
- `BETTER_AUTH_URL` — the base URL of the app, `http://localhost:3000` in
  development. Without it Better Auth derives the origin from the incoming
  request, which makes callbacks and redirects unreliable.

## Files

    app/lib/auth.ts                   the Better Auth instance (server)
    app/lib/authClient.ts             the Better Auth client (browser)
    app/lib/validation/signUp.ts      sign up field rules, shared by both
    app/api/auth/[...all]/route.ts    catch-all handler for /api/auth/*
    app/components/SignUpForm.tsx     the sign up form
    app/sign-up/page.tsx              the /sign-up page

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

The sign up form is tested against a mocked `authClient`, so its tests cover the
form's own behavior (validation, error mapping, redirect) without a server. The
server-side rules are covered in `tests/lib/auth.test.ts`.

## SEE

- Better Auth docs: https://www.better-auth.com/docs
- Prisma guide: https://www.prisma.io/docs/guides/authentication/better-auth/nextjs
- `docs/database.md`
