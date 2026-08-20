/** Compact 12-hour local time with a GMT offset, e.g. `8:11pm (GMT-03:00)`. */

export function formatGmtOffset(now: Date, timeZone: string): string {
  const value =
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(now)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';

  if (value === 'GMT' || value === 'UTC') return 'GMT+00:00';

  const match = value.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return 'GMT+00:00';

  const sign = match[1] ?? '+';
  const hours = (match[2] ?? '0').padStart(2, '0');
  const minutes = (match[3] ?? '00').padStart(2, '0');
  return `GMT${sign}${hours}:${minutes}`;
}

export function formatLocalTime(now: Date, timeZone: string): string {
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  })
    .format(now)
    .replace(/\u202f|\u00a0/g, ' ')
    .replace(' ', '')
    .toLowerCase();

  return `${time} (${formatGmtOffset(now, timeZone)})`;
}
