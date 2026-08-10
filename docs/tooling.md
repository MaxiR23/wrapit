# Tooling

This document explains the development tooling used in wrapit: what each tool
is, why we chose it, and how the pieces fit together. Script names live in
`README.md` (Commands).

## pnpm

### What it is

pnpm is the package manager for this project. It installs dependencies, runs
scripts, and manages the lockfile. It plays the same role as npm or yarn.

### Why we use it

- It is faster and more disk-efficient than npm. Instead of copying every
  dependency into each project, it stores a single global copy and links to it.
- It has stricter dependency resolution, which prevents bugs caused by relying
  on packages that were never explicitly installed.

### Rule

Always use pnpm for this project. Never mix in npm or yarn, because doing so
generates competing lockfiles (package-lock.json / yarn.lock) and leads to
inconsistent dependency trees.

See: https://pnpm.io/motivation

## Prettier

### What it is

Prettier is an opinionated code formatter. It rewrites files so that spacing,
quotes, line width, and other style details are consistent across the whole
codebase. It does not check for bugs; it only handles formatting.

### Why we use it

- It removes formatting from code review. Nobody argues about quotes or indent
  size because the tool decides.
- It keeps git diffs clean: changes reflect real logic changes, not personal
  style differences.

### Configuration (.prettierrc)

Our rules:

- `semi: true` — add a semicolon at the end of statements.
- `singleQuote: true` — use single quotes instead of double quotes.
- `trailingComma: "all"` — add a trailing comma in multi-line lists and objects.
  This produces smaller, cleaner git diffs when adding new items.
- `printWidth: 100` — wrap lines at 100 characters.
- `tabWidth: 2` — indent using 2 spaces.

See: https://prettier.io/docs/options

### What it ignores (.prettierignore)

Prettier skips files it should not touch:

- `node_modules` — third-party dependencies, not our code.
- `.next` — Next.js build output, regenerated automatically.
- `pnpm-lock.yaml` — the lockfile, managed by pnpm.
- `public` — static assets.

See: https://prettier.io/docs/ignore

### Rewriting vs checking

`pnpm format` rewrites files in place. `pnpm format:check` reports what is
unformatted without touching anything, which is the form CI would use.

See: https://prettier.io/docs/cli

## ESLint

### What it is

ESLint is a linter. It analyzes code to catch bugs and enforce good practices
(unused variables, invalid hooks usage, etc.). It comes preconfigured with
Next.js.

See: https://eslint.org/docs/latest/
See: https://nextjs.org/docs/app/api-reference/config/eslint

### How it integrates with Prettier

ESLint and Prettier can conflict, because ESLint also has style rules that may
disagree with Prettier (for example, quote style). To avoid this, we use
`eslint-config-prettier`.

This config turns off all formatting-related rules in ESLint, so the two tools
never fight:

- Prettier handles formatting.
- ESLint handles code correctness.

It is added last in `eslint.config.mjs` so it can disable the style rules
introduced by the Next.js configs above it.

See: https://github.com/prettier/eslint-config-prettier

## lint-staged

### What it is

lint-staged runs linters and formatters only on the files that are staged in
git (the ones added with `git add`), instead of scanning the whole project.

### Why we use it

- Speed: on each commit it only processes changed files, not the entire codebase.
- Consistency: it guarantees that everything committed passes ESLint and Prettier.

### Configuration (.lintstagedrc.json)

- `*.{ts,tsx,js,jsx,mjs}` runs `eslint --fix` and then `prettier --write`.
  ESLint runs first to fix code issues, Prettier second to format.
- `*.{json,css,md}` runs only `prettier --write`, since ESLint does not lint
  those files.

lint-staged is triggered by the Husky pre-commit hook, not run manually.

See: https://github.com/lint-staged/lint-staged

## Husky

### What it is

Husky manages git hooks. A git hook is a script that git runs automatically at
certain points, such as before a commit. We use it to run checks before every
commit.

### Why we use it

- It blocks commits that do not pass linting and formatting, keeping the repo
  clean without relying on people remembering to run the tools.
- The `prepare` script in package.json installs the hooks automatically after a
  fresh `pnpm install`, so every contributor gets them.

### The pre-commit hook (.husky/pre-commit)

The hook runs `pnpm lint-staged` before each commit. If any check fails, the
commit is aborted.

It also contains logic to locate `pnpm` in the PATH. Git hooks run in a
non-login, non-interactive shell, so the profile that activates nvm is never
loaded and `pnpm` can be missing. The hook resolves this by:

1. Sourcing nvm from `$NVM_DIR` (defaulting to `~/.nvm`).
2. Falling back to common install locations (Homebrew paths).
3. Failing with a clear message if `pnpm` still cannot be found.

Machine-specific setup that should not live in the repo can be placed in
`~/.config/husky/init.sh`, which Husky sources before running any hook.

See: https://typicode.github.io/husky/

## Vitest

### What it is

Vitest is the test runner for this project. It executes unit and component
tests. Its API is compatible with Jest (`describe`, `it`, `expect`), but it is
faster and works with ESM and TypeScript out of the box.

### Why we use it

- Native ESM and TypeScript support, with almost no configuration.
- Much faster than Jest, especially in watch mode.
- Jest-compatible API, so the knowledge transfers to other projects.

### Configuration (vitest.config.ts)

- `plugins: [react()]` — lets Vitest understand JSX and React components.
- `environment: 'jsdom'` — runs tests in a simulated DOM, needed to test
  components.
- `globals: true` — allows using `describe`, `it`, `expect` without importing
  them in every file.
- `setupFiles: ['./vitest.setup.ts']` — runs before the tests. It loads the
  `@testing-library/jest-dom` matchers (for example `toBeInTheDocument`).
- `resolve.alias` — maps `@/` to the project root, matching the Next.js alias.

`pnpm test` runs in watch mode and re-runs on every file change, which is the
loop to work in. `pnpm test:run` runs once and exits, for a final check and for
CI. Test conventions live in `docs/testing.md`.

See: https://vitest.dev/
