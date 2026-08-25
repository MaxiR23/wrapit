const DAY_MS = 24 * 60 * 60 * 1000;

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function localDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
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
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** True when the due calendar day is before the viewer's local day. */
export function isCardDueLate(dueDate: Date, now = new Date()): boolean {
  return utcDay(dueDate) < localDay(now);
}

/** English due label: Today, Yesterday, Tomorrow, or a short day+month. */
export function formatCardDue(dueDate: Date, now = new Date()): string {
  const dueStart = utcDay(dueDate);
  const nowStart = localDay(now);
  const deltaDays = Math.round((dueStart - nowStart) / DAY_MS);

  if (deltaDays === 0) return 'Today';
  if (deltaDays === -1) return 'Yesterday';
  if (deltaDays === 1) return 'Tomorrow';

  return dueDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
