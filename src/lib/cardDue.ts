import { formatGmtOffset } from '@/lib/localTime';

const DAY_MS = 24 * 60 * 60 * 1000;

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const CLOCK_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

const TIME_ZONE_ID = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

const MAX_TIME_ZONE_LENGTH = 64;

const DUE_LOCALE = 'en-GB';

/**
 * A due date and the zone it was set in. A null zone means a calendar day
 * stored as UTC midnight; a zone makes `dueDate` a real moment.
 */
export type CardDue = { dueDate: Date; dueTimeZone: string | null };

export type CardDueStyle = 'short' | 'long';

export type CardDueLabel = { text: string; zoneNote: string | null; late: boolean };

export type CardDueOptions = {
  now?: Date;
  viewerTimeZone?: string | null;
  style?: CardDueStyle;
  locale?: string;
};

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function localDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

const zoneFormatters = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = zoneFormatters.get(timeZone);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  zoneFormatters.set(timeZone, created);
  return created;
}

/** True when `timeZone` is an IANA identifier this runtime knows. */
export function isValidTimeZone(timeZone: string): boolean {
  if (timeZone.length === 0 || timeZone.length > MAX_TIME_ZONE_LENGTH) return false;
  if (!TIME_ZONE_ID.test(timeZone)) return false;
  try {
    zoneFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

type WallParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsAt(instant: number, timeZone: string): WallParts {
  const parts = zoneFormatter(timeZone).formatToParts(new Date(instant));
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((item) => item.type === type);
    return part ? Number(part.value) : 0;
  };
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    // Some engines report midnight as hour 24 rather than 0.
    hour: read('hour') % 24,
    minute: read('minute'),
    second: read('second'),
  };
}

/** Offset in ms of `timeZone` at `instant`; east of UTC is positive. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const at = partsAt(instant, timeZone);
  const asUtc = Date.UTC(at.year, at.month - 1, at.day, at.hour, at.minute, at.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** UTC midnight of a YYYY-MM-DD calendar day, or null when the day is invalid. */
export function dueDateFromCalendarDay(day: string): Date | null {
  const match = CALENDAR_DAY.exec(day);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, date));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== date
  ) {
    return null;
  }
  return utc;
}

/** YYYY-MM-DD of a stored due date, read as a UTC calendar day. */
export function calendarDayFromDueDate(date: Date): string {
  const year = pad(date.getUTCFullYear(), 4);
  const month = pad(date.getUTCMonth() + 1, 2);
  const day = pad(date.getUTCDate(), 2);
  return `${year}-${month}-${day}`;
}

/**
 * The instant at which `time` reads on the clock of `timeZone` on `day`.
 *
 * A wall time inside a spring-forward gap resolves one hour later, and an
 * ambiguous fall-back wall time takes its first occurrence.
 */
export function instantFromZonedWallTime(day: string, time: string, timeZone: string): Date | null {
  const dayMatch = CALENDAR_DAY.exec(day);
  const timeMatch = CLOCK_TIME.exec(time);
  if (!dayMatch || !timeMatch) return null;
  if (!isValidTimeZone(timeZone)) return null;

  const year = Number(dayMatch[1]);
  const month = Number(dayMatch[2]);
  const date = Number(dayMatch[3]);
  const naive = Date.UTC(year, month - 1, date, Number(timeMatch[1]), Number(timeMatch[2]));
  const check = new Date(naive);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== date
  ) {
    return null;
  }

  // Probe a day either side so both offsets around a transition are known.
  const before = zoneOffsetMs(naive - DAY_MS, timeZone);
  const after = zoneOffsetMs(naive + DAY_MS, timeZone);
  const fromBefore = naive - before;
  if (before === after) return new Date(fromBefore);

  const fromAfter = naive - after;
  const beforeHolds = zoneOffsetMs(fromBefore, timeZone) === before;
  const afterHolds = zoneOffsetMs(fromAfter, timeZone) === after;

  // Both hold when the clock fell back and the wall time happened twice; the
  // first occurrence wins. Neither holds inside a spring-forward gap, where
  // reading the wall time with the pre-transition offset shifts it past the gap.
  if (beforeHolds && afterHolds) return new Date(Math.min(fromBefore, fromAfter));
  if (afterHolds) return new Date(fromAfter);
  return new Date(fromBefore);
}

/** The calendar day and clock time `instant` reads as in `timeZone`. */
export function zonedWallTime(instant: Date, timeZone: string): { day: string; time: string } {
  const at = partsAt(instant.getTime(), timeZone);
  return {
    day: `${pad(at.year, 4)}-${pad(at.month, 2)}-${pad(at.day, 2)}`,
    time: `${pad(at.hour, 2)}:${pad(at.minute, 2)}`,
  };
}

/** True when the due date has passed, by calendar day or by instant. */
export function isCardDueLate(due: CardDue, now = new Date()): boolean {
  if (due.dueTimeZone == null) return utcDay(due.dueDate) < localDay(now);
  return due.dueDate.getTime() < now.getTime();
}

/**
 * Whole local days from today until the due date. A calendar day uses the
 * viewer's local midnight, matching `isCardDueLate`; a moment uses the
 * viewer's zone (or the card's, then UTC).
 */
export function dueDeltaDays(due: CardDue, options: CardDueOptions = {}): number {
  const now = options.now ?? new Date();
  if (due.dueTimeZone == null) {
    return Math.round((utcDay(due.dueDate) - localDay(now)) / DAY_MS);
  }
  const zone = renderZone(due, options.viewerTimeZone);
  const dueParts = partsAt(due.dueDate.getTime(), zone);
  const nowParts = partsAt(now.getTime(), zone);
  const dueStart = Date.UTC(dueParts.year, dueParts.month - 1, dueParts.day);
  const nowStart = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
  return Math.round((dueStart - nowStart) / DAY_MS);
}

function renderZone(due: CardDue, viewerTimeZone: string | null | undefined): string {
  if (viewerTimeZone != null && isValidTimeZone(viewerTimeZone)) return viewerTimeZone;
  if (due.dueTimeZone != null && isValidTimeZone(due.dueTimeZone)) return due.dueTimeZone;
  return 'UTC';
}

function dayOnlyText(dueDate: Date, now: Date, style: CardDueStyle, locale: string): string {
  if (style === 'long') {
    return dueDate.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  const deltaDays = Math.round((utcDay(dueDate) - localDay(now)) / DAY_MS);
  if (deltaDays === 0) return 'Today';
  if (deltaDays === -1) return 'Yesterday';
  if (deltaDays === 1) return 'Tomorrow';

  return dueDate.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** Compact 12-hour clock without a space, e.g. `4:00pm`. */
function clockText(instant: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  })
    .format(instant)
    .replace(/\u202f|\u00a0/g, ' ')
    .replace(' ', '')
    .toLowerCase();
}

function momentText(
  dueDate: Date,
  now: Date,
  zone: string,
  style: CardDueStyle,
  locale: string,
): string {
  const clock = clockText(dueDate, zone, locale);

  if (style === 'long') {
    const date = dueDate.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: zone,
    });
    return `${date} at ${clock}`;
  }

  const dueParts = partsAt(dueDate.getTime(), zone);
  const nowParts = partsAt(now.getTime(), zone);
  const dueStart = Date.UTC(dueParts.year, dueParts.month - 1, dueParts.day);
  const nowStart = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
  const deltaDays = Math.round((dueStart - nowStart) / DAY_MS);

  if (deltaDays === 0) return `Today ${clock}`;
  if (deltaDays === -1) return `Yesterday ${clock}`;
  if (deltaDays === 1) return `Tomorrow ${clock}`;

  const date = dueDate.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: zone,
  });
  return `${date} ${clock}`;
}

function zoneCityName(timeZone: string): string {
  const last = timeZone.split('/').pop() ?? timeZone;
  return last.replace(/_/g, ' ');
}

/** Names a zone the way due dates refer to it, e.g. `Madrid time (GMT+02:00)`. */
export function describeTimeZone(timeZone: string, at: Date = new Date()): string {
  return `${zoneCityName(timeZone)} time (${formatGmtOffset(at, timeZone)})`;
}

/**
 * Names the zone the moment was set in, but only when the viewer's zone puts
 * it on a different clock. Two ids that share an offset read the same, so
 * comparing offsets rather than ids keeps aliases from raising a false note.
 */
function zoneNoteFor(due: CardDue, zone: string): string | null {
  const origin = due.dueTimeZone;
  if (origin == null || origin === zone) return null;
  if (!isValidTimeZone(origin)) return null;

  const instant = due.dueDate.getTime();
  if (zoneOffsetMs(instant, origin) === zoneOffsetMs(instant, zone)) return null;

  return describeTimeZone(origin, due.dueDate);
}

/**
 * The one due-date label. A calendar day reads against the viewer's local day;
 * a moment is converted into the viewer's zone and names its own zone when the
 * two read differently.
 */
export function cardDueLabel(due: CardDue, options: CardDueOptions = {}): CardDueLabel {
  const now = options.now ?? new Date();
  const style = options.style ?? 'short';
  const locale = options.locale ?? DUE_LOCALE;
  const late = isCardDueLate(due, now);

  if (due.dueTimeZone == null) {
    return { text: dayOnlyText(due.dueDate, now, style, locale), zoneNote: null, late };
  }

  const zone = renderZone(due, options.viewerTimeZone);
  return {
    text: momentText(due.dueDate, now, zone, style, locale),
    zoneNote: zoneNoteFor(due, zone),
    late,
  };
}
