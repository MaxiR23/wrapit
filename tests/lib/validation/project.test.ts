// tests/lib/validation/project.test.ts
//
// Tests for the project field validation.
//
// Tested:
// - Reports no errors for a non-empty title
// - Reports an error when the title is empty
// - Reports an error when the title is only whitespace
//
// What is covered:
// - Happy path, invalid input
//
// Run with: pnpm test:run tests/lib/validation/project.test.ts
//
// SEE: src/lib/validation/project.ts

import { describe, it, expect } from 'vitest';

import { validateProject } from '@/lib/validation/project';

describe('validateProject', () => {
  it('reports no errors for a non-empty title', () => {
    expect(validateProject({ title: 'Sprint board' })).toEqual({});
  });

  it('reports an error when the title is empty', () => {
    expect(validateProject({ title: '' }).title).toBe('Title is required');
  });

  it('reports an error when the title is only whitespace', () => {
    expect(validateProject({ title: '   ' }).title).toBe('Title is required');
  });
});
