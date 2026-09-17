# Development workflow

Flow for every feature, fix or non-trivial change in this repo.

1. **Open an issue**
   - Title: `type: short description`
   - Body: scope, out of scope, acceptance criteria
   - Label matching the commit type: feat, fix, docs, chore, test, refactor

2. **Create the branch**
   - From updated main: `git checkout main && git pull`
   - Naming: `type/short-description` (for example `feat/user-auth`)
   - Use lowercase and hyphens

3. **Write a task spec, only when the issue is not enough**
   - File: `docs/tasks/NNN_short_description.md`
   - Only for work with multiple phases, decisions worth recording, or
     open questions. Most tasks skip this step.

4. **Implement, test first**
   - Red: write the failing test.
   - Green: write the minimum code that makes it pass.
   - Refactor with the tests green.
   - Tests and implementation ship in the same branch and PR.
   - Conventions and the required test file header: docs/testing.md
   - Definition of done: AGENTS.md

5. **Verify locally**
   - Run `pnpm verify`. That is the gate: lint, format check, `tsc --noEmit`,
     tests, then production build, stopping at the first failure.
   - A step that cannot run because of the environment (for example Postgres
     is down) is a failure, not a skip.
   - Commands and the usual pre-commit checks: `README.md` (Commands, Checks).

6. **Review before committing**
   - Review the diff before committing (`git diff`).
   - Optionally run an automated review such as `codex review --uncommitted`.
   - Fix what it flags, run it again until clean.

7. **Commit**
   - Conventional commits: `type: short description`, lowercase, one line.
   - The pre-commit hook runs lint-staged automatically.

8. **Push and open the PR**
   - The pre-push hook refuses the push unless the updated ref is the
     clean checked-out HEAD, then runs `pnpm verify` and blocks the push
     if any step fails.
   - Search existing open and merged PRs for the issue before creating one.
     Reuse an open PR by updating its branch or retargeting its base. Explain any
     replacement PR in both descriptions, and keep the original issue link.
   - The merge target is `main`. A dependent PR can temporarily target a
     feature branch for review, but it stays draft and must be retargeted to
     `main` after its dependency merges. Recheck the diff and checks after
     retargeting. Never merge the dependent PR into that feature branch as a
     substitute for merging it into `main`.
   - Before asking for merge, inspect `baseRefName`, `headRefName`, the diff,
     issue state, and checks on GitHub. The PR body describes the change,
     decisions, and verification. Use `Closes #N` only for an open issue that
     this PR will deliver to `main`; otherwise use `Related to #N`.

9. **Owner decision**
   - The repo owner reviews and merges the PR into `main`. After merging,
     fetch `main` and verify that it contains the change (by commit ancestry
     or the final tree diff). Confirm the issue state separately. Close an
     issue as completed only after its intended change is in `main`; if it is
     closed early, reopen it until delivery. Branch cleanup follows the
     owner's decision.
