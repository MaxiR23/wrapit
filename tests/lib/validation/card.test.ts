// tests/lib/validation/card.test.ts
//
// Tests for the card field validation.
//
// Tested:
// - Reports no errors for a non-empty title
// - Reports an error when the title is empty
// - Allows a missing or empty description
//
// What is covered:
// - Happy path, invalid title, optional description
//
// Run with: pnpm test:run tests/lib/validation/card.test.ts
//
// SEE: src/lib/validation/card.ts

import { describe, it, expect } from 'vitest';

import { validateCard } from '@/lib/validation/card';

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
