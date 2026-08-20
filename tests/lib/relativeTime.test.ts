// tests/lib/relativeTime.test.ts
//
// Tests for formatRelativeTime.
//
// Tested:
// - Says just now under a minute
// - Uses a relative English phrase for hours and days
//
// What is covered:
// - Happy path, under a minute, relative units
//
// Run with: pnpm test:run tests/lib/relativeTime.test.ts
//
// SEE: src/lib/relativeTime.ts

import { describe, it, expect } from 'vitest';

import { formatRelativeTime } from '@/lib/relativeTime';

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-13T22:00:00Z');

  it('says just now for times under a minute old', () => {
    expect(formatRelativeTime(new Date('2026-08-13T21:59:30Z'), now)).toBe('just now');
  });

  it('uses a relative English phrase', () => {
    expect(formatRelativeTime(new Date('2026-08-13T20:00:00Z'), now)).toBe('2 hours ago');
    expect(formatRelativeTime(new Date('2026-08-12T22:00:00Z'), now)).toBe('yesterday');
  });
});
