// tests/lib/localTime.test.ts
//
// Tests for formatting the read-only local time string.
//
// Tested:
// - Formats 12-hour time with a lowercase am/pm and a GMT offset
// - Uses UTC as GMT+00:00
// - Uses a negative offset timezone
//
// What is covered:
// - Happy path, UTC, GMT-03:00
//
// Run with: pnpm test:run tests/lib/localTime.test.ts
//
// SEE: src/lib/localTime.ts

import { describe, it, expect } from 'vitest';

import { formatGmtOffset, formatLocalTime } from '@/lib/localTime';

const now = new Date('2026-08-20T23:11:00Z');

describe('formatGmtOffset', () => {
  it('formats UTC as GMT+00:00', () => {
    expect(formatGmtOffset(now, 'UTC')).toBe('GMT+00:00');
  });

  it('formats a negative offset with two-digit hours', () => {
    expect(formatGmtOffset(now, 'America/Argentina/Buenos_Aires')).toBe('GMT-03:00');
  });
});

describe('formatLocalTime', () => {
  it('formats 12-hour time with a lowercase meridiem and offset', () => {
    expect(formatLocalTime(now, 'UTC')).toBe('11:11pm (GMT+00:00)');
    expect(formatLocalTime(now, 'America/Argentina/Buenos_Aires')).toBe('8:11pm (GMT-03:00)');
  });
});
