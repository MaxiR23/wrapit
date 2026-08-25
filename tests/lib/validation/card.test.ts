// tests/lib/validation/card.test.ts
//
// Tests for the card field validation.
//
// Tested:
// - Reports no errors for a non-empty title
// - Reports an error when the title is empty
// - Allows a missing or empty description
// - Accepts an optional calendar due date on create
// - Rejects a malformed due date and an invalid assignee id
//
// What is covered:
// - Happy path, invalid title, optional description, create due date and assignee ids
//
// Run with: pnpm test:run tests/lib/validation/card.test.ts
//
// SEE: src/lib/validation/card.ts

import { describe, it, expect } from 'vitest';

import { createCardSchema, DUE_DATE_MESSAGE, validateCard } from '@/lib/validation/card';
import { MAX_ID_LENGTH } from '@/lib/validation/id';

describe('validateCard', () => {
  it('reports no errors for a non-empty title', () => {
    expect(validateCard({ title: 'Write tests' })).toEqual({});
  });

  it('reports an error when the title is empty', () => {
    expect(validateCard({ title: '' }).title).toBe('Title is required');
  });

  it('reports an error when the title is only whitespace', () => {
    expect(validateCard({ title: '   ' }).title).toBe('Title is required');
  });

  it('allows a missing description', () => {
    expect(validateCard({ title: 'Write tests' })).toEqual({});
  });

  it('allows an empty description', () => {
    expect(validateCard({ title: 'Write tests', description: '' })).toEqual({});
  });

  it('allows a non-empty description', () => {
    expect(validateCard({ title: 'Write tests', description: 'Cover ownership' })).toEqual({});
  });
});

describe('createCardSchema', () => {
  const base = { columnId: 'column-1', title: 'Write tests' };

  it('accepts an optional calendar due date', () => {
    expect(createCardSchema.safeParse({ ...base, dueDate: '2026-08-25' }).success).toBe(true);
    expect(createCardSchema.safeParse({ ...base, dueDate: '' }).success).toBe(true);
  });

  it('rejects a malformed due date', () => {
    const result = createCardSchema.safeParse({ ...base, dueDate: '25 ago' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(DUE_DATE_MESSAGE);
  });

  it('rejects an assignee id that is empty or oversized', () => {
    expect(createCardSchema.safeParse({ ...base, assigneeIds: [''] }).success).toBe(false);
    expect(
      createCardSchema.safeParse({ ...base, assigneeIds: ['a'.repeat(MAX_ID_LENGTH + 1)] }).success,
    ).toBe(false);
  });
});
