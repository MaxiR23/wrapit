// tests/components/mobileChrome.test.ts
//
// Tests for the shared phone add-button classes and search field DOM props.
//
// Tested:
// - The add button uses the search-row size token and a 1px border
// - Search fields use type=text with role=searchbox
//
// What is covered:
// - Shared class contract. jsdom cannot prove pixel height in Safari.
//
// Run with: pnpm test:run tests/components/mobileChrome.test.ts
//
// SEE: src/components/mobileChrome.ts

import { describe, it, expect } from 'vitest';

import { mobileAddButtonClassName, searchFieldDomProps } from '@/components/mobileChrome';

describe('mobileChrome', () => {
  it('sizes the add button to the search-row token with a matching border', () => {
    expect(mobileAddButtonClassName).toContain('size-mobile-search');
    expect(mobileAddButtonClassName).toContain('border');
    expect(mobileAddButtonClassName).toContain('rounded-md');
  });

  it('uses a text field with searchbox role instead of type=search', () => {
    expect(searchFieldDomProps.type).toBe('text');
    expect(searchFieldDomProps.role).toBe('searchbox');
  });
});
