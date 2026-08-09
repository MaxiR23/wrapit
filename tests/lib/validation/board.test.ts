// tests/lib/validation/board.test.ts
//
// Tests for the board field validation.
//
// Tested:
// - Reports no errors for a non-empty title
// - Reports an error when the title is empty
// - Reports an error when the title is only whitespace
//
// What is covered:
// - Happy path, invalid input
//
// Run with: pnpm test:run tests/lib/validation/board.test.ts
//
// SEE: src/lib/validation/board.ts

import { describe, it, expect } from 'vitest';

import { validateBoard } from '@/lib/validation/board';

describe('validateBoard', () => {
  it('reports no errors for a non-empty title', () => {
    expect(validateBoard({ title: 'Sprint board' })).toEqual({});
  });

  it('reports an error when the title is empty', () => {
    expect(validateBoard({ title: '' }).title).toBe('Title is required');
  });

  it('reports an error when the title is only whitespace', () => {
    expect(validateBoard({ title: '   ' }).title).toBe('Title is required');
  });
});
