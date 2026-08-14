// tests/lib/initials.test.ts
//
// Tests for deriving two-letter initials from a single name field.
//
// Tested:
// - Two or more words use the first letter of the first and last words
// - A single word uses its first two letters
// - Empty or whitespace names fall back to the username
// - Output is always uppercase
//
// What is covered:
// - Multi-word, single-word, empty, whitespace, short strings, casing
//
// Run with: pnpm test:run tests/lib/initials.test.ts
//
// SEE: src/lib/initials.ts

import { describe, it, expect } from 'vitest';

import { initials } from '@/lib/initials';

describe('initials', () => {
  it('uses the first letter of the first and last words', () => {
    expect(initials('Maxi Rebolo')).toBe('MR');
    expect(initials('Maxi de Rebolo')).toBe('MR');
  });

  it('uses the first two letters of a single word', () => {
    expect(initials('Maxi')).toBe('MA');
  });

  it('falls back to the first two letters of the username when the name is empty', () => {
    expect(initials('', 'ada')).toBe('AD');
    expect(initials('   ', 'maxi')).toBe('MA');
  });

  it('uppercases the result', () => {
    expect(initials('ada lovelace')).toBe('AL');
    expect(initials('ada')).toBe('AD');
  });

  it('returns a single letter when the source has only one character', () => {
    expect(initials('A')).toBe('A');
    expect(initials('', 'x')).toBe('X');
  });

  it('returns an empty string when both name and username are blank', () => {
    expect(initials('', '')).toBe('');
    expect(initials('   ', '  ')).toBe('');
  });
});
