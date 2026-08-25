// tests/lib/validation/boardVisibility.test.ts
//
// Tests for the six board-visibility flags.
//
// Tested:
// - Reports no errors when every flag is a boolean
// - Reports an error when a flag is missing or not a boolean
//
// What is covered:
// - Happy path, invalid input
//
// Run with: pnpm test:run tests/lib/validation/boardVisibility.test.ts
//
// SEE: src/lib/validation/boardVisibility.ts

import { describe, it, expect } from 'vitest';

import { validateBoardVisibility } from '@/lib/validation/boardVisibility';

const allOn = {
  label: true,
  code: true,
  comments: true,
  subtasks: true,
  dueDate: true,
  assignees: true,
};

describe('validateBoardVisibility', () => {
  it('reports no errors when every flag is a boolean', () => {
    expect(validateBoardVisibility(allOn)).toEqual({});
    expect(validateBoardVisibility({ ...allOn, label: false, code: false })).toEqual({});
  });

  it('reports an error when a flag is missing or not a boolean', () => {
    expect(validateBoardVisibility({ ...allOn, label: 'off' } as never).label).toBeTruthy();
    expect(
      validateBoardVisibility({
        code: true,
        comments: true,
        subtasks: true,
        dueDate: true,
        assignees: true,
      } as never).label,
    ).toBeTruthy();
  });
});
