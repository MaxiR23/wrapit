// tests/lib/cardDue.test.ts
//
// Tests for card due-date labels and the overdue flag.
//
// Tested:
// - Today, yesterday, and tomorrow use English words
// - Other dates use a short day and month
// - A date before today is late; today is not
//
// What is covered:
// - Relative labels, overdue
//
// Run with: pnpm test:run tests/lib/cardDue.test.ts
//
// SEE: src/lib/cardDue.ts

import { describe, it, expect } from 'vitest';

import { formatCardDue, isCardDueLate } from '@/lib/cardDue';

describe('formatCardDue', () => {
  const now = new Date(2026, 7, 22, 21, 0, 0);

  it('labels today, yesterday, and tomorrow in English', () => {
    expect(formatCardDue(new Date(2026, 7, 22, 8, 0, 0), now)).toBe('Today');
    expect(formatCardDue(new Date(2026, 7, 21, 8, 0, 0), now)).toBe('Yesterday');
    expect(formatCardDue(new Date(2026, 7, 23, 8, 0, 0), now)).toBe('Tomorrow');
  });

  it('formats other dates as day and short month', () => {
    expect(formatCardDue(new Date(2026, 7, 18, 8, 0, 0), now)).toBe('18 Aug');
  });
});

describe('isCardDueLate', () => {
  const now = new Date(2026, 7, 22, 21, 0, 0);

  it('treats dates before today as late and today as on time', () => {
    expect(isCardDueLate(new Date(2026, 7, 21, 23, 0, 0), now)).toBe(true);
    expect(isCardDueLate(new Date(2026, 7, 22, 0, 0, 0), now)).toBe(false);
    expect(isCardDueLate(new Date(2026, 7, 23, 0, 0, 0), now)).toBe(false);
  });
});
