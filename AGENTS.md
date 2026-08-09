# AGENTS.md

Guidance for coding agents working in this repository.

## Project

wrapit — a personal kanban to organize tasks, built as a learning project on a
production-style stack.

Stack, status, setup, commands and layout: `README.md`. It is the single source
of truth for those lists; this file and `docs/` explain the rules and the why,
and never restate them.

## Conventions

- All code and comments in English. No emojis in code.
- Conventional Commits: `type: short description`, lowercase, one line.
- Use `pnpm` only. Never npm or yarn.

## Definition of done

1. Test first: red, green, refactor. See `docs/testing.md`.
2. Lint, format and build pass.
3. Tests for the change ship in the same branch and PR.
4. Relevant `docs/` updated.

## Roles

- Implementation: Claude Code.
- Review: Codex, read-only, before committing.
- Decisions and merge: the repo owner.
- Agents never run git commands (commit, push, merge). The owner handles all git.

## See also

    README.md          stack, commands, layout, setup
    docs/workflow.md   development workflow
    docs/tooling.md    formatters, linters, git hooks, test runner
    docs/testing.md    test conventions
    docs/database.md   database and Prisma usage
    docs/auth.md       Better Auth setup
