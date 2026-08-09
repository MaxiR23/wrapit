// tests/lib/validation/column.test.ts
//
// Tests for the column field validation.
//
// Tested:
// - Reports no errors for a non-empty title
// - Reports an error when the title is empty
// - Reports an error when the title is only whitespace
//
// What is covered:
// - Happy path, invalid input
//
// Run with: pnpm test:run tests/lib/validation/column.test.ts
//
// SEE: src/lib/validation/column.ts

import { describe, it, expect } from 'vitest';

import { validateColumn } from '@/lib/validation/column';

describe('validateColumn', () => {
  it('reports no errors for a non-empty title', () => {
    expect(validateColumn({ title: 'To do' })).toEqual({});
  });

  it('reports an error when the title is empty', () => {
    expect(validateColumn({ title: '' }).title).toBe('Title is required');
  });

  it('reports an error when the title is only whitespace', () => {
    expect(validateColumn({ title: '   ' }).title).toBe('Title is required');
  });
});
