const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** UTC+14 is the time zone where a new calendar day starts first. */
const EARLIEST_TIME_ZONE_HOURS = 14;

/** A calendar date is a text `YYYY-MM-DD` that is a real day (2026-02-31 is not). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }

  const date = parseCalendarDate(value);
  return !Number.isNaN(date.getTime()) && formatCalendarDate(date) === value;
}

/** Converts `YYYY-MM-DD` into a Date at midnight UTC, which is how PostgreSQL DATE columns are read. */
export function parseCalendarDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The most advanced calendar date that exists on Earth right now.
 * "Not in the future" means "not in the future anywhere", so that nobody is
 * refused their own current date because of their time zone.
 */
export function latestCalendarDateOnEarth(now: Date = new Date()): string {
  return formatCalendarDate(new Date(now.getTime() + EARLIEST_TIME_ZONE_HOURS * 3_600_000));
}
