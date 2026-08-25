// tests/lib/cardDue.test.ts
//
// Tests for card due-date labels, calendar-day storage, and the overdue flag.
//
// Tested:
// - Today, yesterday, and tomorrow use English words
// - Other dates use a short day and month
// - A date before today is late; today is not
// - YYYY-MM-DD round-trips through UTC midnight
// - Invalid calendar days are rejected
// - In a negative-offset timezone, 21:00 local on the due date is still today
// - The same card becomes late only after the viewer's local midnight
//
// What is covered:
// - Relative labels, overdue, date-only persist helpers, local calendar day
//
// Run with: pnpm test:run tests/lib/cardDue.test.ts
//
// SEE: src/lib/cardDue.ts

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  calendarDayFromDueDate,
  dueDateFromCalendarDay,
  formatCardDue,
  isCardDueLate,
} from '@/lib/cardDue';

const TZ_MINUS_3 = 'America/Argentina/Buenos_Aires';

describe('dueDateFromCalendarDay', () => {
  it('stores a calendar day as UTC midnight', () => {
    const due = dueDateFromCalendarDay('2026-08-25');

    expect(due).toEqual(new Date(Date.UTC(2026, 7, 25)));
    expect(calendarDayFromDueDate(due!)).toBe('2026-08-25');
  });

  it('rejects a malformed or impossible day', () => {
    expect(dueDateFromCalendarDay('25 ago')).toBeNull();
    expect(dueDateFromCalendarDay('2026-02-31')).toBeNull();
  });
});

describe('formatCardDue', () => {
  const now = new Date(2026, 7, 22, 12, 0, 0);

  it('labels today, yesterday, and tomorrow in English', () => {
    expect(formatCardDue(new Date(Date.UTC(2026, 7, 22)), now)).toBe('Today');
    expect(formatCardDue(new Date(Date.UTC(2026, 7, 21)), now)).toBe('Yesterday');
    expect(formatCardDue(new Date(Date.UTC(2026, 7, 23)), now)).toBe('Tomorrow');
  });

  it('formats other dates as day and short month', () => {
    expect(formatCardDue(new Date(Date.UTC(2026, 7, 18)), now)).toBe('18 Aug');
  });
});

describe('isCardDueLate', () => {
  const now = new Date(2026, 7, 22, 12, 0, 0);

  it('treats dates before today as late and today as on time', () => {
    expect(isCardDueLate(new Date(Date.UTC(2026, 7, 21)), now)).toBe(true);
    expect(isCardDueLate(new Date(Date.UTC(2026, 7, 22)), now)).toBe(false);
    expect(isCardDueLate(new Date(Date.UTC(2026, 7, 23)), now)).toBe(false);
  });
});

describe('due dates in a negative-offset timezone', () => {
  const previousTz = process.env.TZ;
  const due = new Date(Date.UTC(2026, 7, 24));

  beforeEach(() => {
    process.env.TZ = TZ_MINUS_3;
  });

  afterEach(() => {
    if (previousTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTz;
    }
  });

  it('is neither late nor labelled Yesterday at 21:00 local on the due date', () => {
    const now = new Date(2026, 7, 24, 21, 0, 0);

    expect(now.getHours()).toBe(21);
    expect(isCardDueLate(due, now)).toBe(false);
    expect(formatCardDue(due, now)).toBe('Today');
  });

  it('becomes late only after local midnight', () => {
    const justAfterMidnight = new Date(2026, 7, 25, 0, 0, 0);

    expect(isCardDueLate(due, justAfterMidnight)).toBe(true);
    expect(formatCardDue(due, justAfterMidnight)).toBe('Yesterday');
  });
});
