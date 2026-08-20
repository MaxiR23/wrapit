/** Relative English time, without a leading verb. */
export function formatRelativeTime(date: Date, now = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const seconds = Math.round(diffMs / 1000);
  if (Math.abs(seconds) < 60) return 'just now';

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(-days, 'day');
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return formatter.format(-months, 'month');
  const years = Math.round(days / 365);
  return formatter.format(-years, 'year');
}
