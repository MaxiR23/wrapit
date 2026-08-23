function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when the due date is before the start of today (local). */
export function isCardDueLate(dueDate: Date, now = new Date()): boolean {
  return startOfLocalDay(dueDate) < startOfLocalDay(now);
}

/** English due label: Today, Yesterday, Tomorrow, or a short day+month. */
export function formatCardDue(dueDate: Date, now = new Date()): string {
  const dueStart = startOfLocalDay(dueDate);
  const nowStart = startOfLocalDay(now);
  const deltaDays = Math.round((dueStart - nowStart) / DAY_MS);

  if (deltaDays === 0) return 'Today';
  if (deltaDays === -1) return 'Yesterday';
  if (deltaDays === 1) return 'Tomorrow';

  return dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
