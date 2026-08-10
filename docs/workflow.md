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
   - Commands and the usual pre-commit checks: `README.md` (Commands, Checks).
   - Also run `pnpm build` before opening the PR.

6. **Review before committing**
   - Review the diff before committing (`git diff`).
   - Optionally run an automated review such as `codex review --uncommitted`.
   - Fix what it flags, run it again until clean.

7. **Commit**
   - Conventional commits: `type: short description`, lowercase, one line.
   - The pre-commit hook runs lint-staged automatically.

8. **Push and open the PR**
   - Body: what it does, decisions taken, how to test, `Closes #N`.

9. **Merge and later could delete the branch**
