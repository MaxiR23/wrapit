# Testing

Conventions for tests in this repo. The commands are listed in `README.md`:
`pnpm test` while working, `pnpm test:run` for a single run and for CI.

## File location

Tests live in `tests/` at the project root, mirroring the source structure:

    src/lib/utils.ts                -> tests/lib/utils.test.ts
    src/actions/createCard.ts       -> tests/actions/createCard.test.ts
    src/components/boards/Board.tsx -> tests/components/boards/Board.test.tsx

Components are grouped by domain (`AGENTS.md`), and the test tree mirrors that
grouping: `src/components/auth/AuthNav.tsx` is tested by
`tests/components/auth/AuthNav.test.tsx`.

Cross-cutting tests that do not map to a single module live at the root of
`tests/`.

## Naming

Test names describe the behavior being verified, not a category:

    it('omits the reason on a successful response')
    it('returns a validation error when the title is empty')
    it('does not leak internal details on an unhandled error')

The name should be enough to know what broke when it fails.

## Coverage minimums

- Utility / pure logic: happy path, edge cases, and error case.
- Server actions: success, invalid input (validation fails), and error
  (for example unauthorized or DB failure).
- Components: renders what is expected, and responds to user interaction
  (click, typing) where it applies.

## File header

Each test file MUST start with this header:

    // tests/actions/createCard.test.ts
    //
    // Tests for the createCard server action.
    //
    // Tested:
    // - Creates a card and returns it on valid input
    // - Returns a validation error when the title is empty
    // - Returns an error when the user is not authorized
    //
    // What is covered:
    // - Happy path, invalid input, unauthorized
    //
    // Run with: pnpm test:run tests/actions/createCard.test.ts
    //
    // SEE: src/actions/createCard.ts

## Mocking external services

All database and external-provider calls are mocked. Tests never hit a real
service, not even a sandbox. Use Vitest's `vi.fn()` and `vi.mock()`. Configure
mocks so an unhandled call fails instead of passing through, otherwise a test
can silently reach a real service.

## TDD workflow

Red, green, refactor:

1. Write the test. It fails.
2. Write the minimum code to make it pass.
3. Refactor with the tests green.

Tests and implementation ship in the same branch and the same PR. A feature
without tests is not done.

## SEE

- Vitest docs: https://vitest.dev/
- Testing Library: https://testing-library.com/docs/react-testing-library/intro/
