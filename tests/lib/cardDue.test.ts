// tests/lib/cardDue.test.ts
//
// Tests for card due-date labels, calendar-day storage, zone conversion, and
// the overdue flag.
//
// Tested:
// - Today, yesterday, and tomorrow use English words
// - Other dates use a short day and month
// - A date before today is late; today is not
// - YYYY-MM-DD round-trips through UTC midnight
// - Invalid calendar days are rejected
// - In a negative-offset timezone, 21:00 local on the due date is still today
// - The same card becomes late only after the viewer's local midnight
// - A wall time plus a zone resolves to the right instant
// - A wall time inside a spring-forward gap lands one hour later
// - An ambiguous fall-back wall time takes the first occurrence
// - Real IANA zones are accepted and offsets or nonsense are rejected
// - A moment renders in the viewer's zone with its time
// - A moment is late by instant, not by calendar day
// - The zone note appears only when the two zones read differently
//
// What is covered:
// - Relative labels, overdue, date-only persist helpers, local calendar day,
//   zone validation, wall-time-to-instant conversion, DST edges, zone notes
//
// Run with: pnpm test:run tests/lib/cardDue.test.ts
//
// SEE: src/lib/cardDue.ts

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  calendarDayFromDueDate,
  cardDueLabel,
  dueDateFromCalendarDay,
  instantFromZonedWallTime,
  isCardDueLate,
  isValidTimeZone,
  zonedWallTime,
} from '@/lib/cardDue';

const TZ_MINUS_3 = 'America/Argentina/Buenos_Aires';
const TZ_MADRID = 'Europe/Madrid';
const TZ_NEW_YORK = 'America/New_York';

function dayOnly(dueDate: Date) {
  return { dueDate, dueTimeZone: null };
}

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

describe('cardDueLabel for a calendar day', () => {
  const now = new Date(2026, 7, 22, 12, 0, 0);

  it('labels today, yesterday, and tomorrow in English', () => {
    expect(cardDueLabel(dayOnly(new Date(Date.UTC(2026, 7, 22))), { now }).text).toBe('Today');
    expect(cardDueLabel(dayOnly(new Date(Date.UTC(2026, 7, 21))), { now }).text).toBe('Yesterday');
    expect(cardDueLabel(dayOnly(new Date(Date.UTC(2026, 7, 23))), { now }).text).toBe('Tomorrow');
  });

  it('formats other dates as day and short month', () => {
    expect(cardDueLabel(dayOnly(new Date(Date.UTC(2026, 7, 18))), { now }).text).toBe('18 Aug');
  });

  it('formats the long style with a year and no relative words', () => {
    const label = cardDueLabel(dayOnly(new Date(Date.UTC(2026, 7, 22))), { now, style: 'long' });

    expect(label.text).toBe('22 Aug 2026');
  });

  it('never carries a zone note, whatever the viewer zone is', () => {
    const label = cardDueLabel(dayOnly(new Date(Date.UTC(2026, 7, 22))), {
      now,
      viewerTimeZone: TZ_MADRID,
    });

    expect(label.text).toBe('Today');
    expect(label.zoneNote).toBeNull();
  });
});

describe('isCardDueLate for a calendar day', () => {
  const now = new Date(2026, 7, 22, 12, 0, 0);

  it('treats dates before today as late and today as on time', () => {
    expect(isCardDueLate(dayOnly(new Date(Date.UTC(2026, 7, 21))), now)).toBe(true);
    expect(isCardDueLate(dayOnly(new Date(Date.UTC(2026, 7, 22))), now)).toBe(false);
    expect(isCardDueLate(dayOnly(new Date(Date.UTC(2026, 7, 23))), now)).toBe(false);
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
    expect(isCardDueLate(dayOnly(due), now)).toBe(false);
    expect(cardDueLabel(dayOnly(due), { now }).text).toBe('Today');
  });

  it('becomes late only after local midnight', () => {
    const justAfterMidnight = new Date(2026, 7, 25, 0, 0, 0);

    expect(isCardDueLate(dayOnly(due), justAfterMidnight)).toBe(true);
    expect(cardDueLabel(dayOnly(due), { now: justAfterMidnight }).text).toBe('Yesterday');
  });
});

describe('isValidTimeZone', () => {
  it('accepts real IANA identifiers', () => {
    expect(isValidTimeZone(TZ_MADRID)).toBe(true);
    expect(isValidTimeZone(TZ_MINUS_3)).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });

  it('rejects offsets, nonsense, and empty strings', () => {
    expect(isValidTimeZone('+05:00')).toBe(false);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone('a'.repeat(65))).toBe(false);
  });
});

describe('instantFromZonedWallTime', () => {
  it('resolves a wall time in a fixed-offset zone', () => {
    const instant = instantFromZonedWallTime('2026-08-25', '14:30', TZ_MINUS_3);

    expect(instant).toEqual(new Date(Date.UTC(2026, 7, 25, 17, 30)));
  });

  it('resolves a summer wall time using the zone offset in force that day', () => {
    const instant = instantFromZonedWallTime('2026-08-25', '16:00', TZ_MADRID);

    expect(instant).toEqual(new Date(Date.UTC(2026, 7, 25, 14, 0)));
  });

  it('resolves a winter wall time using the zone offset in force that day', () => {
    const instant = instantFromZonedWallTime('2026-01-15', '16:00', TZ_MADRID);

    expect(instant).toEqual(new Date(Date.UTC(2026, 0, 15, 15, 0)));
  });

  it('moves a wall time inside a spring-forward gap one hour later', () => {
    // 2026-03-08 02:30 does not exist in New York; the clock jumps 02:00 to 03:00.
    const instant = instantFromZonedWallTime('2026-03-08', '02:30', TZ_NEW_YORK);

    expect(instant).toEqual(new Date(Date.UTC(2026, 2, 8, 7, 30)));
    expect(zonedWallTime(instant!, TZ_NEW_YORK)).toEqual({ day: '2026-03-08', time: '03:30' });
  });

  it('takes the first occurrence of an ambiguous fall-back wall time', () => {
    // 2026-11-01 01:30 happens twice in New York, at -04:00 then at -05:00.
    const instant = instantFromZonedWallTime('2026-11-01', '01:30', TZ_NEW_YORK);

    expect(instant).toEqual(new Date(Date.UTC(2026, 10, 1, 5, 30)));
  });

  it('rejects a malformed time, day, or zone', () => {
    expect(instantFromZonedWallTime('2026-08-25', '25:00', TZ_MADRID)).toBeNull();
    expect(instantFromZonedWallTime('2026-08-25', '2:30', TZ_MADRID)).toBeNull();
    expect(instantFromZonedWallTime('2026-02-31', '14:30', TZ_MADRID)).toBeNull();
    expect(instantFromZonedWallTime('2026-08-25', '14:30', 'Not/AZone')).toBeNull();
  });
});

describe('zonedWallTime', () => {
  it('reads an instant back as wall parts in a zone', () => {
    const instant = new Date(Date.UTC(2026, 7, 25, 14, 0));

    expect(zonedWallTime(instant, TZ_MADRID)).toEqual({ day: '2026-08-25', time: '16:00' });
    expect(zonedWallTime(instant, TZ_MINUS_3)).toEqual({ day: '2026-08-25', time: '11:00' });
  });

  it('round-trips a wall time through an instant and back', () => {
    const instant = instantFromZonedWallTime('2026-08-25', '16:00', TZ_MADRID);

    expect(zonedWallTime(instant!, TZ_MADRID)).toEqual({ day: '2026-08-25', time: '16:00' });
  });
});

describe('cardDueLabel for a moment', () => {
  const due = {
    dueDate: new Date(Date.UTC(2026, 7, 25, 14, 0)),
    dueTimeZone: TZ_MADRID,
  };

  it('renders the time in the viewer zone', () => {
    const now = new Date(Date.UTC(2026, 7, 20, 12, 0));

    expect(cardDueLabel(due, { now, viewerTimeZone: TZ_MADRID }).text).toBe('25 Aug 4:00pm');
    expect(cardDueLabel(due, { now, viewerTimeZone: TZ_MINUS_3 }).text).toBe('25 Aug 11:00am');
  });

  it('uses relative words based on the calendar day in the viewer zone', () => {
    const now = new Date(Date.UTC(2026, 7, 25, 8, 0));

    expect(cardDueLabel(due, { now, viewerTimeZone: TZ_MADRID }).text).toBe('Today 4:00pm');
  });

  it('falls back to the stored zone when the viewer zone is unknown', () => {
    const now = new Date(Date.UTC(2026, 7, 20, 12, 0));

    expect(cardDueLabel(due, { now, viewerTimeZone: null }).text).toBe('25 Aug 4:00pm');
  });

  it('names the original zone when the viewer reads a different clock', () => {
    const now = new Date(Date.UTC(2026, 7, 20, 12, 0));

    expect(cardDueLabel(due, { now, viewerTimeZone: TZ_MINUS_3 }).zoneNote).toBe(
      'Madrid time (GMT+02:00)',
    );
  });

  it('omits the zone note when the viewer is in the storing zone', () => {
    const now = new Date(Date.UTC(2026, 7, 20, 12, 0));

    expect(cardDueLabel(due, { now, viewerTimeZone: TZ_MADRID }).zoneNote).toBeNull();
  });

  it('omits the zone note when two different ids share an offset at that instant', () => {
    const now = new Date(Date.UTC(2026, 7, 20, 12, 0));

    expect(cardDueLabel(due, { now, viewerTimeZone: 'Europe/Paris' }).zoneNote).toBeNull();
  });

  it('formats the long style with a year and the time', () => {
    const now = new Date(Date.UTC(2026, 7, 20, 12, 0));
    const label = cardDueLabel(due, { now, viewerTimeZone: TZ_MADRID, style: 'long' });

    expect(label.text).toBe('25 Aug 2026 at 4:00pm');
  });
});

describe('isCardDueLate for a moment', () => {
  const due = {
    dueDate: new Date(Date.UTC(2026, 7, 25, 14, 0)),
    dueTimeZone: TZ_MADRID,
  };

  it('compares instants, so a later hour on the due day is not yet late', () => {
    expect(isCardDueLate(due, new Date(Date.UTC(2026, 7, 25, 13, 59)))).toBe(false);
    expect(isCardDueLate(due, new Date(Date.UTC(2026, 7, 25, 14, 1)))).toBe(true);
  });

  it('is late for every viewer at the same instant', () => {
    const previousTz = process.env.TZ;
    process.env.TZ = TZ_MINUS_3;
    try {
      expect(isCardDueLate(due, new Date(Date.UTC(2026, 7, 25, 14, 1)))).toBe(true);
    } finally {
      if (previousTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTz;
      }
    }
  });
});
