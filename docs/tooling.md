# Tooling

This document explains the development tooling used in wrapit: what each tool
is, why we chose it, and how the pieces fit together.

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

### Commands

- `pnpm format` — format every file in place (rewrites files).
- `pnpm format:check` — check formatting without changing files. Useful in CI.

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

### Command

- `pnpm lint` — run ESLint over the project.