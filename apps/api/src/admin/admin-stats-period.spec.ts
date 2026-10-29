import { ADMIN_STATS_PERIODS, DEFAULT_ADMIN_STATS_PERIOD, periodStart } from './admin-stats-period';

describe('admin statistics periods', () => {
  it('only allows 7, 30 and 90 days, with 30 days by default', () => {
    expect(ADMIN_STATS_PERIODS).toEqual(['7d', '30d', '90d']);
    expect(DEFAULT_ADMIN_STATS_PERIOD).toBe('30d');
  });

  it('starts a rolling window exactly that many days before now', () => {
    const now = new Date('2026-10-30T12:00:00.000Z');

    expect(periodStart('7d', now).toISOString()).toBe('2026-10-23T12:00:00.000Z');
    expect(periodStart('30d', now).toISOString()).toBe('2026-09-30T12:00:00.000Z');
    expect(periodStart('90d', now).toISOString()).toBe('2026-08-01T12:00:00.000Z');
  });
});
