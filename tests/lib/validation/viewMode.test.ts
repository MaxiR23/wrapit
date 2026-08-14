// tests/lib/validation/viewMode.test.ts
//
// Tests for the projects view-mode field validation.
//
// Tested:
// - Reports no errors for grid and list
// - Reports an error when viewMode is not a known value
//
// What is covered:
// - Happy path, invalid input
//
// Run with: pnpm test:run tests/lib/validation/viewMode.test.ts
//
// SEE: src/lib/validation/viewMode.ts

import { describe, it, expect } from 'vitest';

import { validateViewMode } from '@/lib/validation/viewMode';

describe('validateViewMode', () => {
  it('reports no errors for grid and list', () => {
    expect(validateViewMode({ viewMode: 'grid' })).toEqual({});
    expect(validateViewMode({ viewMode: 'list' })).toEqual({});
  });

  it('reports an error when viewMode is not a known value', () => {
    expect(
      validateViewMode({ viewMode: 'kanban' } as unknown as { viewMode: 'grid' | 'list' }).viewMode,
    ).toBeTruthy();
  });
});
