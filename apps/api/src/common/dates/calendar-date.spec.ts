import {
  formatCalendarDate,
  isCalendarDate,
  latestCalendarDateOnEarth,
  parseCalendarDate,
} from './calendar-date';

describe('isCalendarDate', () => {
  it.each(['2026-10-15', '2024-02-29', '2000-01-01'])('accepts %p', (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each([
    '2026-02-31',
    '2025-02-29',
    '2026-13-01',
    '2026-00-10',
    '15/10/2026',
    '2026-10-15T10:00:00Z',
    '2026-1-5',
    'tomorrow',
    '',
  ])('rejects %p', (value) => {
    expect(isCalendarDate(value)).toBe(false);
  });

  it('rejects anything that is not a text', () => {
    expect(isCalendarDate(20261015)).toBe(false);
    expect(isCalendarDate(new Date())).toBe(false);
    expect(isCalendarDate(null)).toBe(false);
    expect(isCalendarDate(undefined)).toBe(false);
  });
});

describe('parseCalendarDate and formatCalendarDate', () => {
  it('convert a date to midnight UTC and back', () => {
    const date = parseCalendarDate('2026-10-15');

    expect(date.toISOString()).toBe('2026-10-15T00:00:00.000Z');
    expect(formatCalendarDate(date)).toBe('2026-10-15');
  });
});

describe('latestCalendarDateOnEarth', () => {
  it('is still the same day just before 10:00 UTC', () => {
    expect(latestCalendarDateOnEarth(new Date('2026-10-15T09:59:59Z'))).toBe('2026-10-15');
  });

  it('is already the next day from 10:00 UTC, when UTC+14 reaches midnight', () => {
    expect(latestCalendarDateOnEarth(new Date('2026-10-15T10:00:00Z'))).toBe('2026-10-16');
  });
});
