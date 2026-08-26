# Authentication

How authentication is set up in this repo.

## Stack

[Better Auth](https://www.better-auth.com/) with the Prisma adapter, on the
same PostgreSQL database as the rest of the app.

Only email and password is enabled. Sign up, sign in, sign out, password
reset and route protection all work. There are no social providers.

## Environment variables

They live in `.env` (never committed) and are listed in `.env.example`:

- `BETTER_AUTH_SECRET` — signs sessions and tokens. Generate one with
  `openssl rand -base64 32`. Changing it invalidates every existing session.
- `BETTER_AUTH_URL` — the base URL of the app, `http://localhost:3000` in
  development. Without it Better Auth derives the origin from the incoming
  request, which makes callbacks and redirects unreliable. Password-reset
  emails build the `/reset-password?token=` link from this value.
- `RESEND_API_KEY` — used by `src/lib/email.ts` to send the reset email.
  Never hardcode it.

## Files

Auth-related paths only. The full app map is in `docs/architecture.md`.

    src/proxy.ts                        route protection, runs before every request
    src/lib/routes.ts                   which routes are public; PROJECTS_PATH, MY_TASKS_PATH, projectPath, projectCardPath, ACCOUNT_PATH, accountPath
    src/lib/auth.ts                     the Better Auth instance (server)
    src/lib/authClient.ts               the Better Auth client (browser)
    src/lib/email.ts                    Resend helper for the password-reset email
    src/lib/validation/fieldErrors.ts   first error per field (shared with domain validators)
    src/lib/validation/signUp.ts        sign up field rules
    src/lib/validation/signIn.ts        sign in field rules
    src/lib/validation/forgotPassword.ts  forgot-password field rules
    src/lib/validation/resetPassword.ts reset-password field rules
    src/app/api/auth/[...all]/route.ts  catch-all handler for /api/auth/*
    src/components/auth/SignUpForm.tsx  the sign up form
    src/components/auth/SignInForm.tsx  the sign in form
    src/components/auth/ForgotPasswordForm.tsx  the forgot-password form
    src/components/auth/ResetPasswordForm.tsx   the reset-password form
    src/components/auth/AuthNav.tsx     the nav that hosts the sign out action
    src/components/auth/LandingHero.tsx mobile hero on /sign-in
    src/components/auth/AuthFormIsland.tsx  light form column shared by auth layouts
    src/components/account/useSignOut.ts  shared sign-out for the account menu
    src/components/account/AccountMenu.tsx  topbar/mobile account trigger, popover, sheet
    src/app/account/page.tsx            /account: profile, visibility, and activity tabs
    src/components/projects/ProjectsTopbar.tsx  desktop topbar (search, bell, account menu)
    src/components/projects/ProjectsMobileHeader.tsx  mobile header (brand, bell, account menu)
    src/app/page.tsx                    / is redirect-only: session to /projects, else /sign-in
    src/app/(auth)/layout.tsx           split layout for sign-up, forgot, reset
    src/app/(auth)/sign-up/page.tsx     the /sign-up page
    src/app/(sign-in)/sign-in/layout.tsx  /sign-in: mobile hero + split from auth-sm up
    src/app/(sign-in)/sign-in/page.tsx  the /sign-in page
    src/app/(auth)/forgot-password/page.tsx  the /forgot-password page
    src/app/(auth)/reset-password/page.tsx   the /reset-password page

The auth form column is a **light island** (`.form-island` in
`src/app/globals.css`): light surface and dark text even though `html` is
`dark`. `--form-*` tokens remap the island; `dark:` utilities do not apply
inside it. Shared visual classes live in `src/components/auth/formClasses.ts`.
Input, button and band measurements follow the login handoff; copy and auth
logic stay as they are.

`src/lib/auth.ts` wires Better Auth to the shared Prisma client from
`src/lib/prisma.ts` and enables email and password. Required unique `username`
is declared under `user.additionalFields` (not the username plugin, which also
writes `displayUsername` and our Prisma `User` has no such column).
`sendResetPassword` builds `{BETTER_AUTH_URL}/reset-password?token=` from the
token Better Auth provides and hands it to `sendResetPasswordEmail` in
`src/lib/email.ts`. The
`nextCookies()` plugin goes last in the plugin list; it lets Better Auth set
cookies from server actions.

The route handler mounts every Better Auth endpoint under `/api/auth/`, for
example `/api/auth/sign-up/email` and `/api/auth/get-session`.

`src/lib/authClient.ts` exports `authClient`, created with `createAuthClient()`
from `better-auth/react` plus `inferAdditionalFields<typeof auth>()` so
`signUp.email` accepts `username`. It takes no `baseURL`: the client defaults to
the current origin, which is where the API routes live.

## Sign up

`/sign-up` renders `SignUpForm`, a client component with username, name, email
and password. It uses react-hook-form with `zodResolver(signUpSchema)` so invalid
input never reaches the network, then calls `authClient.signUp.email(...)`. On
success Better Auth sets the session cookie and the form redirects to `/projects`.

The rules live in `src/lib/validation/signUp.ts` as a single zod schema
(`signUpSchema`). The form and `validateSignUp` both use that schema; do not
duplicate the rules. That module also exports `MIN_PASSWORD_LENGTH`, which
`src/lib/auth.ts` passes to `emailAndPassword.minPasswordLength`. It matches
Better Auth's own default of 8; setting it explicitly keeps the browser and the
server from drifting apart. `username` is required, 3–20 characters, and must
match `^[a-z0-9_]+$`.

The client returns `{ data, error }` rather than throwing. Only recognized
codes get a specific message: `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` (the 422
Better Auth sends for a taken email) becomes a message on the email field;
`USERNAME_IS_ALREADY_TAKEN` (if present) becomes a message on the username
field. A duplicate username under `additionalFields` usually hits the DB unique
constraint and surfaces as a generic create failure, which uses the fixed
generic message on the form root. `error.message` is deliberately never
rendered — an unexpected error can carry server internals such as a database
host or a constraint name. Add a code to the recognized list in
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
`authClient.signIn.email(...)`. On success the form redirects to `/projects` and calls
`router.refresh()` so the nav re-reads the session.

The sign-in route has its own layout (`src/app/(sign-in)/sign-in/layout.tsx`),
not the shared `(auth)` split. It is one page with two CSS presentations of the
same form: below `auth-sm` the `LandingHero` sits above the form island; from
`auth-sm` up the existing brand panel and form split is used. Breakpoints only —
no `matchMedia`, no user-agent. Sign-up, forgot-password and reset-password
keep the shared layout and do not show the hero. Why the hero lives here:
`docs/adr/0001-landing-hero-in-signin.md`.

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

The form also links to `/forgot-password`.

## Password reset

`/forgot-password` renders `ForgotPasswordForm`, email only. It calls
`authClient.requestPasswordReset({ email, redirectTo: RESET_PASSWORD_PATH })`.
On success it always shows the same confirmation: "If that email is registered,
a reset link is on its way." Better Auth already returns success for unknown
emails without sending; the form must not add a branch that would reveal
whether the address exists. Any client `{ error }` uses `GENERIC_ERROR_MESSAGE`.

`src/lib/auth.ts` implements `emailAndPassword.sendResetPassword`. The callback
receives `{ user, url, token }` from Better Auth 1.6. It builds
`{BETTER_AUTH_URL}/reset-password?token=` from `token` (the custom-route option
the types document) and sends that URL through `sendResetPasswordEmail`. The
email is plain HTML from `onboarding@resend.dev`. Resend resolves with an
`{ error }` field instead of throwing; the helper throws when that field is
set so Better Auth does not report success for a send that never happened.
The thrown message is for server logs. The form never renders it.

`/reset-password` reads `token` and `error` from the query string and passes
them to `ResetPasswordForm`. A missing token or `error=INVALID_TOKEN` shows
"This reset link is invalid or has expired." and does not render the form.
Otherwise the form takes password and confirmPassword (`resetPasswordSchema`,
same minimum as sign up, confirm must match), then calls
`authClient.resetPassword({ newPassword, token })`. Success redirects to
`/sign-in`. An `INVALID_TOKEN` from the API uses the same expired-link message;
anything else uses the generic message.

## Sign out

`AuthNav` is a client component mounted in `src/app/layout.tsx`. It reads
`authClient.useSession()` and shows either a **Sign out** button or links to
`/sign-in` and `/sign-up`. On `/` and on auth paths (`isAuthPath`: sign-in,
sign-up, forgot-password, reset-password) it returns null so the redirect home
and the auth layouts are not topped by nav links. It also returns null on
`/projects`, `/tasks`, and `/account`, where the projects shell hosts sign out instead. While the
session is still loading on other routes it renders an empty nav, so a signed
in user never sees the signed out links flash.

Sign out calls `authClient.signOut()`, which deletes the `Session` row and
clears the cookie, then redirects to `/sign-in` and calls `router.refresh()`.
A failed sign out shows a fixed message and does not navigate; as everywhere
else, the server message is not rendered.

On `/projects`, `/tasks`, and `/account`, `AuthNav` is hidden, so sign out lives in the account menu
opened from `ProjectsTopbar` (desktop popover) and `ProjectsMobileHeader`
(mobile sheet). The menu calls `useSignOut`, which runs the same
`authClient.signOut()` → `router.push('/sign-in')` → `router.refresh()`
sequence, including the generic failure message. The three tab links point at
`/account?tab=profile|visibility|activity`.

Protection lives in `src/proxy.ts`.

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
- A session on an auth path (`/sign-in`, `/sign-up`, `/forgot-password`,
  `/reset-password`) redirects to `/projects`.

`/` is public so the page can run without a session. It renders no UI: a
session redirects to `/projects`, otherwise to `/sign-in`. Post-login
destinations are consistent on `PROJECTS_PATH` (`/projects`) — proxy,
sign-in/up forms, and the home page.

Everything else is served untouched.

### Public vs private

`src/lib/routes.ts` holds the definitions. Public means reachable without a
session:

    /            home (redirect-only)
    /sign-in     the sign in page
    /sign-up     the sign up page
    /forgot-password  request a reset email
    /reset-password   set a new password from the emailed token
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
lands on `/sign-in` and then on `/projects`, not on the page they asked for.

Server actions always call `auth.api.getSession({ headers: await headers() })`
and scope work to that user. The proxy cookie check alone is not enough. How
reads, writes and membership access fit together: `docs/architecture.md`.

## Database schema

Better Auth owns four models in `prisma/schema.prisma`:

- `User` — identity and profile. It already existed for `Project` creator metadata
  (`ownerId`) and was reconciled with what Better Auth expects.
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
  and leaving it out keeps table names in PascalCase like `Project` and `Card`.
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
`tests/components/auth/SignInForm.test.tsx`,
`tests/components/auth/ForgotPasswordForm.test.tsx`,
`tests/components/auth/ResetPasswordForm.test.tsx`,
`tests/components/auth/AuthNav.test.tsx`,
`tests/components/projects/ProjectsTopbar.test.tsx` and
`tests/components/projects/ProjectsMobileHeader.test.tsx`.
`tests/home.test.tsx` covers the redirect-only `/`;
`tests/app/sign-in-layout.test.tsx` covers the CSS hero/split on `/sign-in`.

The server-side rules are covered in `tests/lib/auth.test.ts` (sign up, sign in,
wrong password, unknown email) and `tests/api/auth/route.test.ts`, which drives
the real route handler with raw `Request` objects and replays the session cookie
to prove that sign out actually removes the `Session` row. Those tests mock
`src/lib/email.ts` so they never call Resend. `tests/lib/email.test.ts` mocks
the Resend client and asserts that a `{ error }` result is thrown.

Route protection is covered in `tests/lib/routes.test.ts` (which paths are
public) and `tests/proxy.test.ts`, which calls the proxy with a `NextRequest`
and asserts where each response redirects. Because the check is optimistic, the
test only has to set or omit the `better-auth.session_token` cookie; the value
is never validated.

## SEE

- Better Auth docs: https://www.better-auth.com/docs
- Prisma guide: https://www.prisma.io/docs/guides/authentication/better-auth/nextjs
- `docs/architecture.md`
- `docs/adr/0001-landing-hero-in-signin.md`
- `docs/database.md`
