// tests/lib/cardCode.test.ts
//
// Tests for stored card codes derived from a project title and sequence.
//
// Tested:
// - Multi-word titles use first and last initials
// - A single-word title uses its first two letters
// - An empty title falls back to PR
// - The sequence is appended after a hyphen with no padding
// - The helper is a pure function of the title at call time
//
// What is covered:
// - Prefix rules, sequence formatting, rename isolation of the function
//
// Run with: pnpm test:run tests/lib/cardCode.test.ts
//
// SEE: src/lib/cardCode.ts

import { describe, it, expect } from 'vitest';

import { cardCode, cardCodePrefix } from '@/lib/cardCode';

describe('cardCodePrefix', () => {
  it('uses the first letter of the first and last words', () => {
    expect(cardCodePrefix('Rediseño del sitio')).toBe('RS');
    expect(cardCodePrefix('Sprint board')).toBe('SB');
  });

  it('uses the first two letters of a single word', () => {
    expect(cardCodePrefix('Kanban')).toBe('KA');
  });

  it('falls back to PR when the title is empty', () => {
    expect(cardCodePrefix('')).toBe('PR');
    expect(cardCodePrefix('   ')).toBe('PR');
  });
});

describe('cardCode', () => {
  it('joins the prefix and sequence with a hyphen and no padding', () => {
    expect(cardCode('Rediseño del sitio', 14)).toBe('RS-14');
    expect(cardCode('Sprint board', 1)).toBe('SB-1');
  });

  it('uses the title passed at call time so a later rename does not rewrite a stored code', () => {
    const stored = cardCode('Sprint board', 1);
    expect(stored).toBe('SB-1');
    expect(cardCode('Website redesign', 1)).toBe('WR-1');
    expect(stored).toBe('SB-1');
  });
});
